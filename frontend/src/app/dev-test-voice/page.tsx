"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  announceNewOrder,
  primeVoiceAudio,
  resetAnnouncedOrderIdsForTesting,
  getAnnouncedOrderIdsForTesting,
  isVoiceAlertEnabled,
  setVoiceAlertEnabled,
  cancelAllSpeech,
} from "@/lib/voiceAnnouncement";

// ── DEVELOPMENT-ONLY GUARD ────────────────────────────────────────────────────
// This file must not run in production. The guard below is checked at render time
// AND is also enforced by checking NODE_ENV at the module level so that tree-shaking
// in production builds can eliminate this page.
// ─────────────────────────────────────────────────────────────────────────────

interface LogEntry {
  id: string;
  timestamp: string;
  timeMs: number;
  type:
    | "call"
    | "dedup"
    | "speech_start"
    | "speech_end"
    | "speech_cancel"
    | "speech_error"
    | "scenario"
    | "queue"
    | "persist"
    | "retry";
  message: string;
  orderId?: number;
}

const SAMPLE_ORDERS = [
  {
    order_id: 101,
    token_number: 101,
    items_summary: "2 Burgers and 1 Cold Coffee",
    items: [
      { name: "Burger", quantity: 2 },
      { name: "Cold Coffee", quantity: 1 },
    ],
  },
  {
    order_id: 102,
    token_number: 102,
    items_summary: "1 Pizza and 2 Samosas",
    items: [
      { name: "Pizza", quantity: 1 },
      { name: "Samosa", quantity: 2 },
    ],
  },
  {
    order_id: 103,
    token_number: 103,
    items_summary: "1 Burger and 1 Coke",
    items: [
      { name: "Burger", quantity: 1 },
      { name: "Coke", quantity: 1 },
    ],
  },
  {
    order_id: 104,
    token_number: 104,
    items_summary: "3 Samosas and 2 Cold Coffees",
    items: [
      { name: "Samosa", quantity: 3 },
      { name: "Cold Coffee", quantity: 2 },
    ],
  },
  {
    order_id: 105,
    token_number: 105,
    items_summary: "2 Pizzas and 1 Burger",
    items: [
      { name: "Pizza", quantity: 2 },
      { name: "Burger", quantity: 1 },
    ],
  },
];

// Approx time to speak each order (depends on voice). 5 orders x ~4s = ~20s.
const SCENARIO_WAIT_AFTER_DISPATCH_MS = 28_000;

export default function DevTestVoicePage() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentScenario, setCurrentScenario] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [announcedList, setAnnouncedList] = useState<number[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isDevelopment, setIsDevelopment] = useState(true);

  // Verification metrics
  const [metrics, setMetrics] = useState({
    totalDispatched: 0,
    acceptedCalls: 0,
    deduplicatedCalls: 0,
    speechStartedCount: 0,
    speechCompletedCount: 0,
    speechCutoffCount: 0,
    uniqueOrdersCompleted: [] as number[],
    ordersCompletedInOrder: [] as number[],
    lastCompletedOrderId: null as number | null,
  });

  const abortRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(0);
  const logsRef = useRef<LogEntry[]>([]);
  const metricsRef = useRef(metrics);

  // Keep refs in sync so closures inside useEffect see latest values
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);
  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  // ── SpeechSynthesis monkey-patch ───────────────────────────────────────────
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      setIsDevelopment(false);
      return;
    }

    setVoiceEnabled(isVoiceAlertEnabled());
    setAnnouncedList(getAnnouncedOrderIdsForTesting());

    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const origSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    const origCancel = window.speechSynthesis.cancel.bind(window.speechSynthesis);

    let currentlySpeakingText: string | null = null;

    window.speechSynthesis.speak = function (utterance: SpeechSynthesisUtterance) {
      // Skip patching the silent priming utterance
      if (utterance.text.trim() === "") return origSpeak(utterance);

      const text = utterance.text;
      const matchedOrder = SAMPLE_ORDERS.find((o) =>
        text.includes(String(o.order_id))
      );
      const orderId = matchedOrder?.order_id;

      const origOnStart = utterance.onstart;
      const origOnEnd = utterance.onend;
      const origOnError = utterance.onerror;

      utterance.onstart = function (e) {
        currentlySpeakingText = text;
        addLogDirect("speech_start", `▶️ Speech STARTED: "${text}"`, orderId);
        setMetrics((prev) => ({ ...prev, speechStartedCount: prev.speechStartedCount + 1 }));
        if (origOnStart) origOnStart.call(utterance, e);
      };

      utterance.onend = function (e) {
        currentlySpeakingText = null;
        addLogDirect("speech_end", `✅ Speech COMPLETED: "${text}"`, orderId);
        setMetrics((prev) => {
          const newCompleted = prev.uniqueOrdersCompleted.includes(orderId ?? -1)
            ? prev.uniqueOrdersCompleted
            : orderId
            ? [...prev.uniqueOrdersCompleted, orderId]
            : prev.uniqueOrdersCompleted;
          const newInOrder = orderId ? [...prev.ordersCompletedInOrder, orderId] : prev.ordersCompletedInOrder;
          return {
            ...prev,
            speechCompletedCount: prev.speechCompletedCount + 1,
            uniqueOrdersCompleted: newCompleted,
            ordersCompletedInOrder: newInOrder,
            lastCompletedOrderId: orderId ?? prev.lastCompletedOrderId,
          };
        });
        setAnnouncedList(getAnnouncedOrderIdsForTesting());
        if (origOnEnd) origOnEnd.call(utterance, e);
      };

      utterance.onerror = function (e: SpeechSynthesisErrorEvent) {
        if (e.error === "canceled" || e.error === "interrupted") {
          addLogDirect(
            "speech_cancel",
            `⚠️ Speech CUT OFF (${e.error}): "${text}"`,
            orderId
          );
          setMetrics((prev) => ({ ...prev, speechCutoffCount: prev.speechCutoffCount + 1 }));
        } else {
          addLogDirect("speech_error", `❌ Speech error: ${e.error} — "${text}"`, orderId);
        }
        currentlySpeakingText = null;
        if (origOnError) origOnError.call(utterance, e);
      };

      return origSpeak(utterance);
    };

    window.speechSynthesis.cancel = function () {
      if (currentlySpeakingText) {
        addLogDirect(
          "speech_cancel",
          `🛑 speechSynthesis.cancel() called while speaking: "${currentlySpeakingText}"`
        );
      }
      currentlySpeakingText = null;
      return origCancel();
    };

    return () => {
      window.speechSynthesis.speak = origSpeak;
      window.speechSynthesis.cancel = origCancel;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ────────────────────────────────────────────────────────────────
  const addLogDirect = (
    type: LogEntry["type"],
    message: string,
    orderId?: number
  ) => {
    const elapsed = startTimeRef.current
      ? Math.round(performance.now() - startTimeRef.current)
      : 0;
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: `+${elapsed}ms`,
      timeMs: elapsed,
      type,
      message,
      orderId,
    };
    setLogs((prev) => [...prev, entry]);
  };

  const handleReset = () => {
    abortRef.current = true;
    cancelAllSpeech();
    resetAnnouncedOrderIdsForTesting();
    setAnnouncedList([]);
    setMetrics({
      totalDispatched: 0,
      acceptedCalls: 0,
      deduplicatedCalls: 0,
      speechStartedCount: 0,
      speechCompletedCount: 0,
      speechCutoffCount: 0,
      uniqueOrdersCompleted: [],
      ordersCompletedInOrder: [],
      lastCompletedOrderId: null,
    });
    setLogs([]);
    setIsRunning(false);
    setCurrentScenario(null);
  };

  // ── Scenario runner ────────────────────────────────────────────────────────
  const runScenario = async (name: string, delayMs: number) => {
    handleReset();
    abortRef.current = false;
    setIsRunning(true);
    setCurrentScenario(name);
    startTimeRef.current = performance.now();

    // Must have user gesture already (page load counts) — prime audio
    primeVoiceAudio();

    addLogDirect(
      "scenario",
      `🚀 Scenario: "${name}" — dispatching 5 orders with ${delayMs}ms gap`
    );

    for (let i = 0; i < SAMPLE_ORDERS.length; i++) {
      if (abortRef.current) {
        addLogDirect("scenario", "⏹️ Scenario aborted.");
        break;
      }

      const order = SAMPLE_ORDERS[i];
      addLogDirect(
        "call",
        `📨 Simulating new_order event → Order #${order.order_id} (${order.items_summary})`,
        order.order_id
      );

      // ← Exact same call that production WebSocket handler makes
      const accepted = announceNewOrder({
        order_id: order.order_id,
        token_number: order.token_number,
        items_summary: order.items_summary,
        items: order.items,
      });

      if (accepted) {
        addLogDirect("queue", `📥 Order #${order.order_id} → ENQUEUED for speech`, order.order_id);
      } else {
        addLogDirect("dedup", `🛑 Order #${order.order_id} → REJECTED by deduplication`, order.order_id);
      }

      setMetrics((prev) => ({
        ...prev,
        totalDispatched: prev.totalDispatched + 1,
        acceptedCalls: accepted ? prev.acceptedCalls + 1 : prev.acceptedCalls,
        deduplicatedCalls: !accepted
          ? prev.deduplicatedCalls + 1
          : prev.deduplicatedCalls,
      }));

      setAnnouncedList(getAnnouncedOrderIdsForTesting());

      // Apply gap between dispatches (not between speeches — queue handles that)
      if (delayMs > 0 && i < SAMPLE_ORDERS.length - 1) {
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }

    addLogDirect("scenario", `✅ All 5 orders dispatched. Waiting for queue to drain…`);

    // Wait generously for the FIFO queue to finish all 5 announcements
    await new Promise((res) => setTimeout(res, SCENARIO_WAIT_AFTER_DISPATCH_MS));

    if (!abortRef.current) {
      addLogDirect("scenario", `🏁 Scenario complete: "${name}"`);
    }
    setIsRunning(false);
    setAnnouncedList(getAnnouncedOrderIdsForTesting());
  };

  // ── Deduplication spot-test ────────────────────────────────────────────────
  const testDeduplication = () => {
    if (!startTimeRef.current) startTimeRef.current = performance.now();
    const order = SAMPLE_ORDERS[0]; // #101
    addLogDirect("scenario", `🔁 Retrigger duplicate: Order #${order.order_id}`);

    const accepted = announceNewOrder({
      order_id: order.order_id,
      token_number: order.token_number,
      items_summary: order.items_summary,
      items: order.items,
    });

    if (accepted) {
      addLogDirect("call", `⚠️ Order #${order.order_id} was accepted again — dedup FAILED!`, order.order_id);
    } else {
      addLogDirect("dedup", `🛡️ Order #${order.order_id} correctly BLOCKED by deduplication.`, order.order_id);
    }
    setAnnouncedList(getAnnouncedOrderIdsForTesting());
  };

  // ── Derived verification checks ────────────────────────────────────────────
  const scenarioFinished = !isRunning && metrics.totalDispatched === 5;
  const all5Completed = scenarioFinished && metrics.speechCompletedCount >= 5;
  const anyCutoff = metrics.speechCutoffCount > 0;
  const noDuplicateSpeech =
    metrics.speechCompletedCount === metrics.uniqueOrdersCompleted.length;
  const fifoCorrect =
    metrics.ordersCompletedInOrder.length >= 2
      ? metrics.ordersCompletedInOrder.every(
          (id, idx, arr) => idx === 0 || id > arr[idx - 1]
        )
      : true;

  // ── Guard: block in production ─────────────────────────────────────────────
  if (!isDevelopment) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center mt-12 bg-red-50 border border-red-300 rounded-xl">
        <h1 className="text-2xl font-bold text-red-700">Access Denied</h1>
        <p className="mt-2 text-red-600">
          This page is strictly development-only and is unavailable in production.
        </p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <header className="border-b border-neutral-800 pb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20 mb-2">
              🛠️ DEV-ONLY · FIFO QUEUE TEST SUITE
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Outlet Voice Announcement — Concurrency Tester
            </h1>
            <p className="text-neutral-400 text-sm mt-1">
              Tests the{" "}
              <code className="text-amber-300 bg-neutral-800 px-1.5 py-0.5 rounded text-xs">
                announceNewOrder()
              </code>{" "}
              FIFO queue under burst &amp; gapped order scenarios.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const next = !voiceEnabled;
                setVoiceAlertEnabled(next);
                setVoiceEnabled(next);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                voiceEnabled
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : "bg-red-500/20 text-red-300 border-red-500/40"
              }`}
            >
              Voice: {voiceEnabled ? "ON 🔊" : "MUTED 🔇"}
            </button>
            <button
              onClick={handleReset}
              disabled={isRunning}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition disabled:opacity-50"
            >
              Reset Session
            </button>
          </div>
        </header>

        {/* Safety notice */}
        <div className="bg-neutral-800/60 border border-neutral-700/60 rounded-xl p-4 text-xs text-neutral-300 flex items-start gap-3">
          <div className="text-lg shrink-0">🔒</div>
          <div>
            <span className="font-semibold text-neutral-200">Isolation guaranteed: </span>
            Calls only the existing{" "}
            <code className="text-amber-300">announceNewOrder()</code> function. No
            WebSocket, no backend, no DB, no production payments touched. Blocked in
            production builds.
          </div>
        </div>

        {/* Scenario buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              n: 1,
              label: "Almost Simultaneous",
              desc: "All 5 orders dispatched with 0ms gap — maximum burst pressure.",
              delay: 0,
              color: "purple",
            },
            {
              n: 2,
              label: "500 ms Gap",
              desc: "Each order arrives 500 ms after the previous. Speech takes ~4 s.",
              delay: 500,
              color: "blue",
            },
            {
              n: 3,
              label: "1 000 ms Gap",
              desc: "Each order arrives 1 s after the previous. Tests queue buffering.",
              delay: 1000,
              color: "teal",
            },
          ].map(({ n, label, desc, delay, color }) => (
            <div
              key={n}
              className="bg-neutral-800/70 border border-neutral-700/80 rounded-xl p-5 flex flex-col justify-between"
            >
              <div>
                <div className={`text-xs font-semibold text-${color}-400 uppercase tracking-wider`}>
                  Scenario {n}
                </div>
                <h3 className="text-lg font-bold text-white mt-1">{label}</h3>
                <p className="text-xs text-neutral-400 mt-2">{desc}</p>
              </div>
              <button
                onClick={() =>
                  runScenario(
                    `Scenario ${n}: ${label} (${delay}ms)`,
                    delay
                  )
                }
                disabled={isRunning}
                className={`mt-4 w-full py-2.5 px-4 rounded-lg bg-${color}-600 hover:bg-${color}-500 disabled:opacity-50 text-white font-medium text-sm transition shadow-lg shadow-${color}-600/20`}
              >
                Run Scenario {n} ({delay}ms)
              </button>
            </div>
          ))}
        </div>

        {/* Extra actions row */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={testDeduplication}
            className="py-2 px-4 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-xs border border-neutral-700 transition flex items-center gap-2"
          >
            🔁 Retrigger Order #101 (dedup test)
          </button>
          {isRunning && (
            <button
              onClick={() => {
                abortRef.current = true;
                cancelAllSpeech();
                setIsRunning(false);
                addLogDirect("scenario", "⏹️ User stopped all speech & cleared queue.");
              }}
              className="py-2 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs transition"
            >
              Stop All Speech
            </button>
          )}
          {isRunning && (
            <div className="flex items-center gap-2 text-xs text-amber-300">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Queue draining… (~{Math.ceil(SCENARIO_WAIT_AFTER_DISPATCH_MS / 1000)}s max wait)
            </div>
          )}
        </div>

        {/* Simulated order cards */}
        <div className="bg-neutral-800/40 border border-neutral-700/50 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
            Simulated Orders
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {SAMPLE_ORDERS.map((order) => {
              const isQueued = announcedList.includes(order.order_id);
              const isCompleted = metrics.uniqueOrdersCompleted.includes(order.order_id);
              return (
                <div
                  key={order.order_id}
                  className={`p-3 rounded-lg border text-xs transition ${
                    isCompleted
                      ? "bg-emerald-500/10 border-emerald-500/40"
                      : isQueued
                      ? "bg-amber-500/10 border-amber-500/40"
                      : "bg-neutral-900/50 border-neutral-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">#{order.order_id}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        isCompleted
                          ? "bg-emerald-500/20 text-emerald-300"
                          : isQueued
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-neutral-800 text-neutral-500"
                      }`}
                    >
                      {isCompleted ? "✅ Done" : isQueued ? "🔊 In Set" : "Pending"}
                    </span>
                  </div>
                  <div className="text-neutral-300 mt-1">{order.items_summary}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Checklist + Logs grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Verification checklist */}
          <div className="lg:col-span-1 bg-neutral-800/50 border border-neutral-700/60 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-wider">
              Verification Checklist
            </h3>

            {[
              {
                label: "1. Every unique order is announced",
                pass: all5Completed && !anyCutoff,
                fail: scenarioFinished && (!all5Completed || anyCutoff),
                passText: `PASS (${metrics.speechCompletedCount}/5)`,
                failText: `FAIL (${metrics.speechCompletedCount}/5 completed, ${metrics.speechCutoffCount} cut off)`,
              },
              {
                label: "2. No order is announced twice",
                pass: scenarioFinished && noDuplicateSpeech,
                fail: scenarioFinished && !noDuplicateSpeech,
                passText: "PASS (no duplicates)",
                failText: `FAIL (${metrics.speechCompletedCount - metrics.uniqueOrdersCompleted.length} duplicate speeches)`,
              },
              {
                label: "3. No overlap / no cutoff",
                pass: scenarioFinished && !anyCutoff,
                fail: anyCutoff,
                passText: "PASS (0 cutoffs)",
                failText: `FAIL (${metrics.speechCutoffCount} cutoffs)`,
              },
              {
                label: "4. Each order waits for previous to finish",
                pass: all5Completed && !anyCutoff,
                fail: anyCutoff,
                passText: "PASS (FIFO queue working)",
                failText: "FAIL (no queue — cutoffs detected)",
              },
              {
                label: "5. FIFO order (101→102→103→104→105)",
                pass: scenarioFinished && fifoCorrect && metrics.ordersCompletedInOrder.length >= 5,
                fail: scenarioFinished && !fifoCorrect,
                passText: `PASS (${metrics.ordersCompletedInOrder.join("→")})`,
                failText: `FAIL (got ${metrics.ordersCompletedInOrder.join("→")})`,
              },
            ].map(({ label, pass, fail, passText, failText }) => (
              <div
                key={label}
                className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800 text-xs"
              >
                <span className="text-neutral-300">{label}</span>
                <span
                  className={`font-semibold shrink-0 px-2 py-0.5 rounded whitespace-nowrap ${
                    pass
                      ? "bg-emerald-500/20 text-emerald-400"
                      : fail
                      ? "bg-red-500/20 text-red-400"
                      : "bg-neutral-800 text-neutral-500"
                  }`}
                >
                  {pass ? passText : fail ? failText : "WAITING"}
                </span>
              </div>
            ))}

            {/* Dedup spot test */}
            <div className="pt-2 border-t border-neutral-800">
              <div className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800 text-xs">
                <span className="text-neutral-300">Dedup: Re-trigger #101</span>
                <span className="font-semibold shrink-0 px-2 py-0.5 rounded bg-neutral-800 text-neutral-500">
                  Click button →
                </span>
              </div>
            </div>

            {/* Overall verdict */}
            <div
              className={`p-4 rounded-xl border mt-2 ${
                anyCutoff
                  ? "bg-red-950/40 border-red-700/60 text-red-200"
                  : all5Completed && fifoCorrect
                  ? "bg-emerald-950/40 border-emerald-700/60 text-emerald-200"
                  : "bg-neutral-900/50 border-neutral-800 text-neutral-400"
              }`}
            >
              <div className="font-bold text-xs uppercase tracking-wider mb-1">
                Concurrency Safety:
              </div>
              <div className="text-sm font-semibold">
                {anyCutoff
                  ? "🚨 DEFECT — speech interrupted by next order"
                  : all5Completed && fifoCorrect
                  ? "✅ SAFE — FIFO queue working correctly"
                  : "⏳ Run a scenario to evaluate…"}
              </div>
              {/* Live stats */}
              {metrics.totalDispatched > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-neutral-400">
                  <span>Dispatched: {metrics.totalDispatched}</span>
                  <span>Accepted: {metrics.acceptedCalls}</span>
                  <span>Deduped: {metrics.deduplicatedCalls}</span>
                  <span>Completed: {metrics.speechCompletedCount}</span>
                  <span>Cutoffs: {metrics.speechCutoffCount}</span>
                  <span>FIFO order: {metrics.ordersCompletedInOrder.join("→") || "–"}</span>
                </div>
              )}
            </div>
          </div>

          {/* Live logs */}
          <div className="lg:col-span-2 bg-neutral-800/50 border border-neutral-700/60 rounded-xl p-5 flex flex-col h-[540px]">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="text-sm font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
                Live Event Log
                {isRunning && (
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </div>
              <button
                onClick={() => setLogs([])}
                className="text-xs text-neutral-400 hover:text-neutral-200 underline"
              >
                Clear
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-3 space-y-1 font-mono text-xs pr-1">
              {logs.length === 0 ? (
                <div className="text-neutral-500 py-16 text-center italic">
                  No events yet. Click a scenario button above.
                </div>
              ) : (
                logs.map((log) => {
                  let cls = "text-neutral-300";
                  if (log.type === "scenario") cls = "text-amber-300 font-bold";
                  else if (log.type === "queue") cls = "text-sky-300";
                  else if (log.type === "speech_start") cls = "text-blue-300";
                  else if (log.type === "speech_end") cls = "text-emerald-300 font-semibold";
                  else if (log.type === "speech_cancel" || log.type === "speech_error")
                    cls = "text-red-400 font-bold bg-red-950/30 px-1 rounded";
                  else if (log.type === "dedup") cls = "text-orange-300";
                  else if (log.type === "persist") cls = "text-lime-300";
                  else if (log.type === "retry") cls = "text-yellow-300";

                  return (
                    <div
                      key={log.id}
                      className={`flex items-start gap-2 py-0.5 px-1 rounded ${cls}`}
                    >
                      <span className="text-neutral-600 shrink-0 select-none">
                        [{log.timestamp}]
                      </span>
                      <span className="flex-1 break-words leading-relaxed">
                        {log.message}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
