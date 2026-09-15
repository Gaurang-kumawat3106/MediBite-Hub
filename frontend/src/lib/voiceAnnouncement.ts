/**
 * Voice Announcement Utility for Outlet Head Dashboard
 * Uses browser-native SpeechSynthesis API to announce new paid orders.
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

// In-memory set of announced order IDs (synced with sessionStorage)
const announcedOrderIds = new Set<number>();

// Initialize from sessionStorage on client
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

/**
 * Check if voice alerts are enabled by the user (defaults to true)
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
 * Enable or disable voice alerts
 */
export function setVoiceAlertEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("bb_voice_alerts_enabled", enabled ? "true" : "false");
  } catch {
    // Ignore storage errors
  }
}

/**
 * Prime audio context / SpeechSynthesis on user interaction (tap/click)
 * Required by mobile Chrome / Android / iOS autoplay restrictions.
 */
let isAudioPrimed = false;
export function primeVoiceAudio(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (isAudioPrimed) return;

  try {
    const silent = new SpeechSynthesisUtterance(" ");
    silent.volume = 0.01;
    silent.rate = 10; // ultra fast
    window.speechSynthesis.speak(silent);
    isAudioPrimed = true;
  } catch {
    // Ignore priming error
  }
}

/**
 * Convert number or number string to spoken form or clean representation
 */
function formatNumberForSpeech(num: string | number): string {
  return String(num);
}

/**
 * Helper to pluralize item names naturally for speech
 */
function formatItemSpeech(qty: number, name: string): string {
  const cleanName = name.trim();
  if (qty <= 1) {
    return `one ${cleanName}`;
  }
  // If already ends in 's' or plural-like, keep it
  if (cleanName.toLowerCase().endsWith("s") || cleanName.toLowerCase().endsWith("ch") || cleanName.toLowerCase().endsWith("sh")) {
    return `${qty} ${cleanName}`;
  }
  return `${qty} ${cleanName}s`;
}

/**
 * Format a list of items into natural English speech
 * e.g., "Two burgers and one cold coffee"
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

    if (parts.length === 1) {
      return parts[0];
    }
    if (parts.length === 2) {
      return `${parts[0]} and ${parts[1]}`;
    }
    return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
  }

  if (summary && summary.trim()) {
    return summary.trim();
  }

  return "new items";
}

/**
 * Find the best available natural English voice
 */
function getBestEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // Prefer Indian English or standard English natural voices
  const preferred = voices.find(
    (v) => (v.lang === "en-IN" || v.lang === "en_IN") && (v.name.includes("Google") || v.name.includes("Natural"))
  );
  if (preferred) return preferred;

  const enIn = voices.find((v) => v.lang === "en-IN" || v.lang === "en_IN");
  if (enIn) return enIn;

  const googleEn = voices.find((v) => v.lang.startsWith("en") && v.name.includes("Google"));
  if (googleEn) return googleEn;

  const anyEn = voices.find((v) => v.lang.startsWith("en"));
  if (anyEn) return anyEn;

  return voices[0] || null;
}

// Keep global reference to avoid garbage collection bug on Android Chrome
let activeUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Speak text using browser SpeechSynthesis API
 */
export function speakText(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve(false);
      return;
    }

    try {
      // Cancel previous stuck utterance
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      activeUtterance = utterance;

      utterance.rate = 0.95; // slightly slower for maximum clarity in busy canteens
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voice = getBestEnglishVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = "en-US";
      }

      utterance.onend = () => {
        activeUtterance = null;
        resolve(true);
      };

      utterance.onerror = (e) => {
        console.warn("SpeechSynthesis error:", e);
        activeUtterance = null;
        resolve(false);
      };

      // Workaround for Chrome bug where voice is silent if voices are not yet loaded
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          const loadedVoice = getBestEnglishVoice();
          if (loadedVoice) {
            utterance.voice = loadedVoice;
            utterance.lang = loadedVoice.lang;
          }
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
 * Announce a new paid order using SpeechSynthesis
 * Formats: "New order number {order_number}. {items_summary}."
 * Avoids duplicates for the same order ID.
 */
export function announceNewOrder(order: OrderAnnouncementData): boolean {
  if (!order || !order.order_id) return false;

  // 1. Check if already announced
  if (announcedOrderIds.has(order.order_id)) {
    return false;
  }

  // 2. Mark as announced immediately to prevent duplicate triggers
  persistAnnouncedId(order.order_id);

  // 3. Check user preference
  if (!isVoiceAlertEnabled()) {
    return false;
  }

  // 4. Construct speech text
  // Use token number if present, otherwise order id
  const orderNum = order.token_number
    ? formatNumberForSpeech(order.token_number)
    : formatNumberForSpeech(order.order_id);

  const itemsText = buildItemsSpeechText(order.items_summary, order.items);
  const speechMessage = `New order number ${orderNum}. ${itemsText}.`;

  console.log("🔊 Announcing new order:", speechMessage);
  speakText(speechMessage);
  return true;
}

/**
 * Test announcement button helper
 */
export function testVoiceAnnouncement(): void {
  const sampleMessage = "New order number 27. Two burgers and one cold coffee.";
  speakText(sampleMessage);
}
