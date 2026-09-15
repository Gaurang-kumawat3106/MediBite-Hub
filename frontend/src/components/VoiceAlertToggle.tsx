"use client";

import { useEffect, useState } from "react";
import {
  isVoiceAlertEnabled,
  setVoiceAlertEnabled,
  primeVoiceAudio,
  testVoiceAnnouncement,
} from "@/lib/voiceAnnouncement";
import toast from "react-hot-toast";

interface VoiceAlertToggleProps {
  compact?: boolean;
}

export default function VoiceAlertToggle({ compact = false }: VoiceAlertToggleProps) {
  const [enabled, setEnabled] = useState(true);
  const [isPlayingTest, setIsPlayingTest] = useState(false);

  useEffect(() => {
    setEnabled(isVoiceAlertEnabled());

    // Prime audio on any interaction with the document
    const handleFirstInteraction = () => {
      primeVoiceAudio();
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
    };

    window.addEventListener("click", handleFirstInteraction, { once: true });
    window.addEventListener("touchstart", handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
    };
  }, []);

  const handleToggle = () => {
    primeVoiceAudio();
    const next = !enabled;
    setEnabled(next);
    setVoiceAlertEnabled(next);
    if (next) {
      toast.success("🔊 Voice announcements turned ON", { duration: 2500 });
    } else {
      toast("🔇 Voice announcements muted", { duration: 2500, icon: "🔇" });
    }
  };

  const handleTest = (e: React.MouseEvent) => {
    e.stopPropagation();
    primeVoiceAudio();
    setIsPlayingTest(true);
    testVoiceAnnouncement();
    toast("Speaking: 'New order number 27. Two burgers and one cold coffee.'", {
      icon: "🗣️",
      duration: 3500,
    });
    setTimeout(() => setIsPlayingTest(false), 3000);
  };

  return (
    <div className="inline-flex items-center gap-1.5 bg-white border border-gray-200/80 shadow-sm rounded-xl p-1 text-xs">
      <button
        type="button"
        onClick={handleToggle}
        title={enabled ? "Voice announcements are active for new orders" : "Voice announcements are muted"}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer select-none ${
          enabled
            ? "bg-amber-50 text-amber-900 border border-amber-200/60 hover:bg-amber-100"
            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
        }`}
      >
        <i className={`fa-solid ${enabled ? "fa-volume-high text-amber-600" : "fa-volume-xmark text-gray-400"}`}></i>
        <span>{enabled ? "Voice: ON" : "Voice: OFF"}</span>
      </button>

      {enabled && (
        <button
          type="button"
          onClick={handleTest}
          disabled={isPlayingTest}
          title="Test voice announcement on this device"
          className="px-2 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-medium transition-colors cursor-pointer"
        >
          {isPlayingTest ? (
            <i className="fa-solid fa-spinner fa-spin text-amber-600"></i>
          ) : (
            <span className="flex items-center gap-1">
              <i className="fa-solid fa-play text-[10px] text-gray-400"></i>
              <span>Test</span>
            </span>
          )}
        </button>
      )}
    </div>
  );
}
