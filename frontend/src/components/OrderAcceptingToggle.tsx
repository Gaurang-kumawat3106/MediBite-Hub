"use client";

import { useState, useEffect } from "react";
import { fetchWithCSRF } from "@/lib/csrf";
import { getApiUrl } from "@/lib/utils";
import { invalidateAllCache } from "@/lib/apiCache";

interface OrderAcceptingToggleProps {
  initialState?: boolean;
  compact?: boolean;
  onStatusChange?: (isAccepting: boolean) => void;
  className?: string;
}

export default function OrderAcceptingToggle({
  initialState,
  compact = false,
  onStatusChange,
  className = "",
}: OrderAcceptingToggleProps) {
  const [isAccepting, setIsAccepting] = useState<boolean>(initialState ?? true);
  const [loading, setLoading] = useState(initialState === undefined);
  const [updating, setUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // If initial state wasn't passed, fetch current outlet status
  useEffect(() => {
    if (initialState !== undefined) {
      setIsAccepting(initialState);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/app/outlet/toggle-accepting/`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && isMounted) {
            setIsAccepting(data.is_accepting_orders);
          }
        }
      } catch (err) {
        console.error("Failed to fetch order receiving status", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchStatus();
    return () => {
      isMounted = false;
    };
  }, [initialState]);

  const handleToggle = async () => {
    if (updating || loading) return;
    setUpdating(true);
    setStatusMessage(null);

    const targetState = !isAccepting;

    try {
      const res = await fetchWithCSRF(`${getApiUrl()}/app/outlet/toggle-accepting/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ is_accepting_orders: targetState }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAccepting(data.is_accepting_orders);
        if (onStatusChange) {
          onStatusChange(data.is_accepting_orders);
        }
        invalidateAllCache();
        setStatusMessage(
          data.is_accepting_orders
            ? "Now accepting orders"
            : "Orders paused for customers"
        );
      } else {
        setStatusMessage(data.error || "Failed to change status");
      }
    } catch (err) {
      console.error("Error toggling order acceptance:", err);
      setStatusMessage("Network error. Try again.");
    } finally {
      setUpdating(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
        isAccepting
          ? "bg-emerald-50/70 border-emerald-200/80 text-emerald-900"
          : "bg-red-50/80 border-red-200/90 text-red-900"
      } ${className}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {isAccepting && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isAccepting ? "bg-emerald-500" : "bg-red-500"
              }`}
            ></span>
          </span>
          <div className="truncate">
            <div className="text-xs font-bold leading-tight truncate">
              {loading ? "Checking..." : isAccepting ? "Receiving Orders" : "Orders Stopped"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={loading || updating}
          aria-label={isAccepting ? "Stop receiving orders" : "Start receiving orders"}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            isAccepting ? "bg-emerald-600 focus:ring-emerald-500" : "bg-gray-300 focus:ring-gray-400"
          } ${updating || loading ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
              isAccepting ? "translate-x-5" : "translate-x-0"
            }`}
          >
            {updating && (
              <i className="fa-solid fa-spinner fa-spin text-[10px] text-gray-500"></i>
            )}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-3xl border p-5 sm:p-6 transition-all shadow-sm ${
        isAccepting
          ? "bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40 border-emerald-200"
          : "bg-gradient-to-br from-amber-50/90 via-white to-red-50/40 border-amber-200"
      } ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 transition-all ${
              isAccepting
                ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                : "bg-red-500 text-white shadow-md shadow-red-500/20"
            }`}
          >
            {updating ? (
              <i className="fa-solid fa-spinner fa-spin"></i>
            ) : isAccepting ? (
              <i className="fa-solid fa-store"></i>
            ) : (
              <i className="fa-solid fa-store-slash"></i>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold font-heading text-[#2b1b10]">
                {isAccepting ? "Accepting Orders" : "Stop Receiving Orders (Paused)"}
              </h3>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isAccepting
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isAccepting ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                  }`}
                ></span>
                {isAccepting ? "Live" : "Stopped"}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              {isAccepting
                ? "Your outlet is open and receiving new customer orders."
                : "Your outlet is closed. It appears black & white to customers and orders are blocked."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          <span className="text-xs font-bold text-gray-500 hidden sm:inline">
            {isAccepting ? "Orders ON" : "Orders OFF"}
          </span>
          <button
            type="button"
            onClick={handleToggle}
            disabled={loading || updating}
            className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isAccepting
                ? "bg-emerald-500 focus:ring-emerald-400"
                : "bg-gray-300 focus:ring-gray-400"
            } ${updating || loading ? "opacity-60 cursor-not-allowed" : ""}`}
            role="switch"
            aria-checked={isAccepting}
          >
            <span
              className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                isAccepting ? "translate-x-6 text-emerald-600" : "translate-x-0 text-gray-400"
              }`}
            >
              {updating ? (
                <i className="fa-solid fa-spinner fa-spin text-xs"></i>
              ) : isAccepting ? (
                <i className="fa-solid fa-check text-xs font-bold"></i>
              ) : (
                <i className="fa-solid fa-xmark text-xs font-bold"></i>
              )}
            </span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`mt-3 text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-2 animate-in fade-in duration-200 ${
            isAccepting
              ? "bg-emerald-100/70 text-emerald-800"
              : "bg-red-100/70 text-red-800"
          }`}
        >
          <i
            className={`fa-solid ${
              isAccepting ? "fa-circle-check" : "fa-triangle-exclamation"
            }`}
          ></i>
          {statusMessage}
        </div>
      )}
    </div>
  );
}
