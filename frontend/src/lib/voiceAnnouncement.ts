/**
 * Voice Announcement Utility for Outlet Head Dashboard
 * Uses browser-native SpeechSynthesis API to announce new paid orders.
 *
 * QUEUE BEHAVIOUR (v2):
 *  - Multiple orders are placed in a FIFO queue and spoken one after another.
 *  - No announcement is ever cancelled by a new incoming order.
 *  - An order is only persisted as "announced" after its speech successfully
 *    completes.  If speech is interrupted or errors, the order is removed from
 *    the announced set so the next page load can retry it.
 *  - cancelAllSpeech() is the ONLY intentional cancellation path (user action).
 */

export interface OrderItemForSpeech {
  name?: string;
  product_name?: string;
  quantity?: number;
}

export interface OrderAnnouncementData {
  order_id: number;
  token_number?: string | number | null;
  items_summary?: string;
  items?: OrderItemForSpeech[];
}

// ── Deduplication ──────────────────────────────────────────────────────────────
// In-memory set of order IDs that have been queued/announced (synced with sessionStorage).
// Adding an ID here immediately prevents the same order from being enqueued twice,
// even if multiple events fire simultaneously.  Persistence to sessionStorage happens
// only AFTER the speech utterance completes successfully.
const announcedOrderIds = new Set<number>();

// Initialize from sessionStorage on client so refreshes don't re-announce old orders
if (typeof window !== "undefined") {
  try {
    const stored = sessionStorage.getItem("bb_announced_order_ids");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => announcedOrderIds.add(Number(id)));
      }
    }
  } catch (e) {
    console.warn("Could not load announced order IDs from sessionStorage:", e);
  }
}

/** Persist a successfully announced order ID to sessionStorage. */
function persistAnnouncedId(orderId: number) {
  announcedOrderIds.add(orderId);
  if (typeof window !== "undefined") {
    try {
      const arr = Array.from(announcedOrderIds).slice(-100); // keep last 100
      sessionStorage.setItem("bb_announced_order_ids", JSON.stringify(arr));
    } catch {
      // Ignore storage quota errors
    }
  }
}

/** Remove a failed/cancelled order ID so the next load can retry. */
function removeAnnouncedId(orderId: number) {
  announcedOrderIds.delete(orderId);
  if (typeof window !== "undefined") {
    try {
      const arr = Array.from(announcedOrderIds).slice(-100);
      sessionStorage.setItem("bb_announced_order_ids", JSON.stringify(arr));
    } catch {
      // Ignore storage quota errors
    }
  }
}

// ── Dev-only helpers ───────────────────────────────────────────────────────────

/**
 * Dev-only test helper to clear announced order history.
 */
export function resetAnnouncedOrderIdsForTesting(): void {
  announcedOrderIds.clear();
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem("bb_announced_order_ids");
    } catch {
      // ignore
    }
  }
}

/**
 * Dev-only test helper to inspect announced order IDs.
 */
export function getAnnouncedOrderIdsForTesting(): number[] {
  return Array.from(announcedOrderIds);
}

// ── User preferences ───────────────────────────────────────────────────────────

/**
 * Check if voice alerts are enabled by the user (defaults to true).
 */
export function isVoiceAlertEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const val = localStorage.getItem("bb_voice_alerts_enabled");
    return val !== "false"; // Default is ON
  } catch {
    return true;
  }
}

/**
 * Enable or disable voice alerts.
 */
export function setVoiceAlertEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("bb_voice_alerts_enabled", enabled ? "true" : "false");
  } catch {
    // Ignore storage errors
  }
}

// ── Audio priming ──────────────────────────────────────────────────────────────

/**
 * Prime audio context / SpeechSynthesis on user interaction (tap/click).
 * Required by mobile Chrome / Android / iOS autoplay restrictions.
 * Fires a near-instant silent utterance directly (intentionally bypasses queue).
 */
let isAudioPrimed = false;
export function primeVoiceAudio(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (isAudioPrimed) return;

  try {
    const silent = new SpeechSynthesisUtterance(" ");
    silent.volume = 0.01;
    silent.rate = 10; // ultra fast — completes in < 50 ms
    window.speechSynthesis.speak(silent);
    isAudioPrimed = true;
  } catch {
    // Ignore priming error
  }
}

// ── Speech helpers ─────────────────────────────────────────────────────────────

/**
 * Convert number or number string to spoken form or clean representation.
 */
function formatNumberForSpeech(num: string | number): string {
  return String(num);
}

/**
 * Helper to pluralize item names naturally for speech.
 */
function formatItemSpeech(qty: number, name: string): string {
  const cleanName = name.trim();
  if (qty <= 1) {
    return `one ${cleanName}`;
  }
  // If already ends in 's', 'ch', or 'sh' keep it
  if (
    cleanName.toLowerCase().endsWith("s") ||
    cleanName.toLowerCase().endsWith("ch") ||
    cleanName.toLowerCase().endsWith("sh")
  ) {
    return `${qty} ${cleanName}`;
  }
  return `${qty} ${cleanName}s`;
}

/**
 * Format a list of items into natural English speech.
 * e.g. "two burgers and one cold coffee"
 */
export function buildItemsSpeechText(
  summary?: string,
  items?: OrderItemForSpeech[]
): string {
  if (items && items.length > 0) {
    const parts = items.map((item) => {
      const qty = item.quantity || 1;
      const name = item.name || item.product_name || "item";
      return formatItemSpeech(qty, name);
    });

    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
    return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
  }

  if (summary && summary.trim()) return summary.trim();
  return "new items";
}

/**
 * Find the best available natural English voice.
 */
function getBestEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // Prefer Indian English or standard English natural voices
  const preferred = voices.find(
    (v) =>
      (v.lang === "en-IN" || v.lang === "en_IN") &&
      (v.name.includes("Google") || v.name.includes("Natural"))
  );
  if (preferred) return preferred;

  const enIn = voices.find((v) => v.lang === "en-IN" || v.lang === "en_IN");
  if (enIn) return enIn;

  const googleEn = voices.find(
    (v) => v.lang.startsWith("en") && v.name.includes("Google")
  );
  if (googleEn) return googleEn;

  const anyEn = voices.find((v) => v.lang.startsWith("en"));
  if (anyEn) return anyEn;

  return voices[0] || null;
}

// ── FIFO Speech Queue ──────────────────────────────────────────────────────────

interface SpeechQueueItem {
  text: string;
  /**
   * The order ID this item belongs to (null for non-order speech such as test
   * helpers or priming).  Used to persist / remove from announcedOrderIds
   * depending on whether speech succeeded or failed.
   */
  orderId: number | null;
}

const speechQueue: SpeechQueueItem[] = [];
let isSpeakingQueue = false;

// Keep global reference to avoid garbage-collection bug on Android Chrome
let activeUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Internal: speak a single utterance without cancelling anything first.
 * Returns a Promise that resolves true on success, false on error/cancel.
 */
function speakTextImmediate(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve(false);
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      activeUtterance = utterance;

      utterance.rate = 0.95; // slightly slower for clarity in busy canteens
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const assignVoice = () => {
        const voice = getBestEnglishVoice();
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        } else {
          utterance.lang = "en-US";
        }
      };
      assignVoice();

      utterance.onend = () => {
        activeUtterance = null;
        resolve(true);
      };

      utterance.onerror = (e) => {
        console.warn("SpeechSynthesis error:", e);
        activeUtterance = null;
        resolve(false);
      };

      // Workaround for Chrome bug: voices may not be loaded yet on first call
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          assignVoice();
          window.speechSynthesis.speak(utterance);
        };
      } else {
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error("Failed to speak text:", err);
      resolve(false);
    }
  });
}

/**
 * Dequeue and speak the next item.  Chains recursively until the queue is empty.
 */
function processNextInQueue(): void {
  if (speechQueue.length === 0) {
    isSpeakingQueue = false;
    return;
  }

  isSpeakingQueue = true;
  const item = speechQueue.shift()!;

  speakTextImmediate(item.text).then((success) => {
    if (item.orderId !== null) {
      if (success) {
        // Persist only after confirmed completion
        persistAnnouncedId(item.orderId);
      } else {
        // Speech failed or was interrupted — remove so it can be retried
        removeAnnouncedId(item.orderId);
        console.warn(
          `🔇 Order #${item.orderId} speech failed/cancelled — removed from announced set for retry.`
        );
      }
    }
    // Always process the next item regardless of success/failure
    processNextInQueue();
  });
}

/**
 * Enqueue a speech item.  If the queue is idle, start processing immediately.
 */
function enqueueSpeech(text: string, orderId: number | null): void {
  speechQueue.push({ text, orderId });
  if (!isSpeakingQueue) {
    processNextInQueue();
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Cancel all currently playing and pending speech.
 * Use ONLY for explicit user-initiated stop actions — NOT on incoming orders.
 */
export function cancelAllSpeech(): void {
  // Drain the queue
  speechQueue.length = 0;
  isSpeakingQueue = false;
  activeUtterance = null;
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Speak arbitrary text.  Enqueued behind any currently speaking announcement.
 * Does NOT cancel ongoing speech.
 */
export function speakText(text: string): void {
  enqueueSpeech(text, null);
}

/**
 * Announce a new paid order using SpeechSynthesis.
 * Formats: "New order number {order_number}. {items_summary}."
 *
 * Guarantees:
 *  - Same order ID is never announced twice (deduplication).
 *  - Never interrupts an ongoing announcement (FIFO queue).
 *  - Order is only persisted to sessionStorage after speech succeeds.
 *  - If speech is cut off externally, the order is removed so it can be retried.
 */
export function announceNewOrder(order: OrderAnnouncementData): boolean {
  if (!order || !order.order_id) return false;

  // 1. Deduplication check — reject if already queued or announced
  if (announcedOrderIds.has(order.order_id)) {
    return false;
  }

  // 2. Reserve this order ID in-memory immediately.
  //    This prevents the same order from being enqueued twice if multiple
  //    simultaneous events arrive (e.g. WebSocket + polling both fire).
  //    Persistence to sessionStorage is deferred until speech succeeds.
  announcedOrderIds.add(order.order_id);

  // 3. Check user preference.
  //    If voice is off, mark as permanently announced (same as original behaviour).
  if (!isVoiceAlertEnabled()) {
    persistAnnouncedId(order.order_id);
    return false;
  }

  // 4. Construct speech text
  const orderNum = order.token_number
    ? formatNumberForSpeech(order.token_number)
    : formatNumberForSpeech(order.order_id);

  const itemsText = buildItemsSpeechText(order.items_summary, order.items);
  const speechMessage = `New order number ${orderNum}. ${itemsText}.`;

  console.log("🔊 Queuing new order announcement:", speechMessage);
  enqueueSpeech(speechMessage, order.order_id);
  return true;
}

/**
 * Test announcement helper — speaks a sample message.
 */
export function testVoiceAnnouncement(): void {
  speakText("New order number 27. Two burgers and one cold coffee.");
}
