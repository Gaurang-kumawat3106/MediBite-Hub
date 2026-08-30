"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithCSRF } from "@/lib/csrf";
import { getApiUrl } from "@/lib/utils";

interface GoogleLoginButtonProps {
  onError?: (msg: string) => void;
  onSuccess?: () => void;
  buttonText?: string;
}

declare global {
  interface Window {
    google?: any;
  }
}

const DEFAULT_CLIENT_ID =
  "118735085794-i148s1fbk1ji3hh39npphejsqe50dh41.apps.googleusercontent.com";

export default function GoogleLoginButton({
  onError,
  onSuccess,
  buttonText = "Continue with Google",
}: GoogleLoginButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID;

  const handleCredentialResponse = async (response: any) => {
    if (!response || !response.credential) {
      onError?.("Google authentication failed. Please try again.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetchWithCSRF(`${getApiUrl()}/app/google-login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ id_token: response.credential }),
      });

      const data = await res.json();

      if (data.success) {
        if (data.session_key) {
          localStorage.setItem("bb_session_key", data.session_key);
        }
        if (data.user?.username) {
          localStorage.setItem("bb_username", data.user.username);
        }

        onSuccess?.();
        router.replace("/customer/home");
      } else {
        onError?.(data.msg || "Google authentication failed.");
      }
    } catch (err) {
      console.error("Error during Google authentication:", err);
      onError?.("A network error occurred during Google sign in.");
    } finally {
      setIsLoading(false);
    }
  };

  const initAndPrompt = () => {
    if (!window.google?.accounts?.id) return;
    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        use_fedcm_for_prompt: false,
      });

      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          const hiddenDiv = document.getElementById("gsi-hidden-render-target");
          if (hiddenDiv) {
            hiddenDiv.innerHTML = "";
            window.google.accounts.id.renderButton(hiddenDiv, {
              type: "standard",
              theme: "outline",
              size: "large",
            });
            const btn = hiddenDiv.querySelector("div[role=button]") as HTMLElement;
            if (btn) btn.click();
          }
        }
      });
    } catch (err) {
      console.error("Google Sign-In initialization error:", err);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!window.google?.accounts?.id) {
      const existingScript = document.getElementById("google-gsi-script");
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "google-gsi-script";
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }
  }, []);

  const handleClick = () => {
    if (!window.google?.accounts?.id) {
      const script = document.getElementById("google-gsi-script");
      if (script) {
        script.addEventListener("load", initAndPrompt);
      } else {
        onError?.("Google Sign-In is initializing. Please try again in a moment.");
      }
      return;
    }
    initAndPrompt();
  };

  return (
    <div className="w-full flex flex-col items-center justify-center">
      <div id="gsi-hidden-render-target" className="hidden"></div>

      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-gray-300 bg-white text-[#2b1b10] font-semibold text-sm hover:bg-gray-50 active:bg-gray-100 transition-all duration-200 shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-brand/20 border-t-brand rounded-full animate-spin"></div>
        ) : (
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span>{buttonText}</span>
      </button>
    </div>
  );
}
