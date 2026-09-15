"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function PwaInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"ios" | "desktop" | "android" | "installed" | "general">("general");

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    // Check if running in standalone (already installed)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setModalType("installed");
      setShowModal(true);
      return;
    }

    // If native prompt is available
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === "accepted") {
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.error("Install prompt error:", err);
      }
      return;
    }

    // Fallback detection for browser-specific instructions
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isMac = /Macintosh/.test(ua);
    const isDesktop = isMac || /Windows|Linux/.test(ua);
    const isAndroid = /Android/.test(ua);

    if (isIOS) {
      setModalType("ios");
    } else if (isDesktop) {
      setModalType("desktop");
    } else if (isAndroid) {
      setModalType("android");
    } else {
      setModalType("general");
    }
    setShowModal(true);
  };

  return (
    <>
      <div className="w-full pt-4 mt-4 border-t border-gray-100 flex flex-col items-center">
        <button
          id="pwa-install-button"
          type="button"
          onClick={handleInstallClick}
          className="w-full py-3 px-4 rounded-xl bg-black hover:bg-neutral-800 active:scale-[0.99] text-white text-sm font-semibold flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-all cursor-pointer select-none"
        >
          <i className="fa-solid fa-download text-sm"></i>
          <span>Install Bhukkad Box App</span>
        </button>
      </div>

      {/* Modern Instructions Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1"
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-black text-white flex items-center justify-center text-lg flex-shrink-0">
                <i className="fa-solid fa-mobile-screen-button"></i>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 leading-tight">Install Bhukkad Box</h3>
                <p className="text-xs text-gray-500">Quick access from your home screen</p>
              </div>
            </div>

            <div className="text-sm text-gray-600 mb-5 leading-relaxed">
              {modalType === "installed" && (
                <div className="text-center py-2">
                  <p className="font-semibold text-green-700 mb-1">
                    <i className="fa-solid fa-circle-check text-green-600 mr-1.5"></i>
                    Already Installed!
                  </p>
                  <p className="text-xs text-gray-500">
                    Bhukkad Box is already installed on this device. You can open it from your applications or home screen.
                  </p>
                </div>
              )}

              {modalType === "ios" && (
                <div className="space-y-3">
                  <p className="font-medium text-gray-800">To install on iOS Safari:</p>
                  <ol className="space-y-2 pl-4 list-decimal text-xs text-gray-600">
                    <li>
                      Tap the <strong className="text-gray-900">Share</strong> button{" "}
                      <i className="fa-solid fa-arrow-up-from-bracket text-blue-600 ml-1"></i> at the bottom of Safari.
                    </li>
                    <li>
                      Scroll down and select <strong className="text-gray-900">Add to Home Screen</strong>{" "}
                      <i className="fa-regular fa-square-plus ml-1"></i>.
                    </li>
                    <li>
                      Tap <strong className="text-gray-900">Add</strong> in the top-right corner.
                    </li>
                  </ol>
                </div>
              )}

              {modalType === "desktop" && (
                <div className="space-y-2.5">
                  <p className="font-medium text-gray-800">To install on your computer:</p>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs space-y-2">
                    <div>
                      <strong className="text-gray-900">Method 1:</strong> Look for the <strong>Install</strong> icon{" "}
                      (<i className="fa-solid fa-arrow-down-to-bracket text-gray-700"></i> or{" "}
                      <i className="fa-solid fa-desktop text-gray-700"></i>) in your browser address bar on the right.
                    </div>
                    <div>
                      <strong className="text-gray-900">Method 2:</strong> Click the browser menu (
                      <strong className="text-gray-900">⋮</strong> or <strong className="text-gray-900">…</strong>) &rarr; select{" "}
                      <strong className="text-gray-900">&apos;Install Bhukkad Box&apos;</strong>.
                    </div>
                  </div>
                </div>
              )}

              {(modalType === "android" || modalType === "general") && (
                <div className="space-y-2.5">
                  <p className="font-medium text-gray-800">To install the app:</p>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                    Tap the browser menu (<strong className="text-gray-900">⋮</strong>) in the top-right corner, then tap{" "}
                    <strong className="text-gray-900">&apos;Install app&apos;</strong> or{" "}
                    <strong className="text-gray-900">&apos;Add to Home screen&apos;</strong>.
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="w-full py-2.5 bg-black hover:bg-neutral-800 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
