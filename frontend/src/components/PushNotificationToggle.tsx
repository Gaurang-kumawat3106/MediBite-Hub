"use client";

import { usePushNotifications } from "@/hooks/usePushNotifications";

interface PushNotificationToggleProps {
  compact?: boolean;
  className?: string;
  roleLabel?: string; // e.g. "order updates" or "new order alerts"
}

export default function PushNotificationToggle({
  compact = false,
  className = "",
  roleLabel = "live order updates",
}: PushNotificationToggleProps) {
  const {
    permission,
    isSubscribed,
    isSupported,
    loading,
    error,
    subscribeUser,
    unsubscribeUser,
  } = usePushNotifications();

  if (!isSupported) {
    return null; // Graceful fallback if push isn't supported by browser/device
  }

  if (compact) {
    return (
      <button
        onClick={() => (isSubscribed ? unsubscribeUser() : subscribeUser())}
        disabled={loading || permission === "denied"}
        className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
          isSubscribed
            ? "bg-green-50 text-green-700 border border-green-200/80 hover:bg-green-100"
            : permission === "denied"
            ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
            : "bg-orange-500 text-white hover:bg-orange-600 shadow-sm hover:shadow active:scale-95"
        } ${className}`}
        title={
          permission === "denied"
            ? "Notifications blocked in browser settings"
            : isSubscribed
            ? "Notifications enabled. Click to turn off."
            : `Click to enable push notifications for ${roleLabel}`
        }
      >
        <i
          className={`fa-solid ${
            loading
              ? "fa-circle-notch fa-spin"
              : isSubscribed
              ? "fa-bell text-green-600"
              : "fa-bell-slash"
          }`}
        ></i>
        <span>
          {loading
            ? "Updating..."
            : isSubscribed
            ? "Push Active"
            : permission === "denied"
            ? "Blocked"
            : "Enable Push"}
        </span>
      </button>
    );
  }

  return (
    <div
      className={`bg-white/95 backdrop-blur-sm border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 ${className}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-colors ${
              isSubscribed
                ? "bg-green-100 text-green-600"
                : permission === "denied"
                ? "bg-red-50 text-red-500"
                : "bg-orange-100 text-orange-600 animate-pulse"
            }`}
          >
            <i
              className={`fa-solid ${
                isSubscribed
                  ? "fa-bell"
                  : permission === "denied"
                  ? "fa-bell-slash"
                  : "fa-bell"
              }`}
            ></i>
          </div>
          <div>
            <h4 className="font-bold text-sm text-[#2b1b10] flex items-center gap-2">
              Push Notifications
              {isSubscribed && (
                <span className="bg-green-500 w-2 h-2 rounded-full inline-block animate-ping"></span>
              )}
            </h4>
            <p className="text-xs text-gray-500">
              {isSubscribed
                ? `Active — receiving ${roleLabel} even when browser is closed.`
                : permission === "denied"
                ? "Blocked in browser permissions. Enable site notifications in browser settings."
                : `Get real-time push alerts for ${roleLabel} when tab is closed.`}
            </p>
          </div>
        </div>

        <div>
          {permission === "denied" ? (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
              Blocked
            </span>
          ) : (
            <button
              onClick={() => (isSubscribed ? unsubscribeUser() : subscribeUser())}
              disabled={loading}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
                isSubscribed
                  ? "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                  : "bg-brand text-white hover:bg-brand-dark shadow-sm hover:shadow-md active:scale-95"
              }`}
            >
              {loading && <i className="fa-solid fa-circle-notch fa-spin"></i>}
              {isSubscribed ? "Turn Off" : "Enable Push"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-2 text-xs text-red-500 flex items-center gap-1">
          <i className="fa-solid fa-circle-exclamation"></i>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
