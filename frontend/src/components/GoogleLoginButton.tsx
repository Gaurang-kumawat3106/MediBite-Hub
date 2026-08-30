"use client";

import { useEffect, useState, useRef } from "react";
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

export default function GoogleLoginButton({
  onError,
  onSuccess,
  buttonText = "Continue with Google",
}: GoogleLoginButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

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

  useEffect(() => {
    if (typeof window === "undefined" || !clientId) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return;

      try {
        // Disable FedCM to prevent "Only one navigator.credentials.get request" conflicts in Chrome
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
          use_fedcm_for_prompt: false,
        });

        if (googleBtnContainerRef.current) {
          googleBtnContainerRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: "outline",
            size: "large",
            width: "360",
            text: buttonText.toLowerCase().includes("sign") ? "signup_with" : "continue_with",
            shape: "rectangular",
            logo_alignment: "left",
          });
        }
      } catch (err) {
        console.error("Error initializing Google Identity Services:", err);
      }
    };

    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      const existingScript = document.getElementById("google-gsi-script");
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "google-gsi-script";
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = initGoogle;
        document.head.appendChild(script);
      } else {
        existingScript.addEventListener("load", initGoogle);
      }
    }
  }, [clientId, buttonText]);

  return (
    <div className="w-full flex flex-col items-center justify-center min-h-[44px]">
      {isLoading ? (
        <div className="w-full py-3 flex items-center justify-center gap-2 text-sm text-gray-500 font-medium">
          <div className="w-5 h-5 border-2 border-brand/20 border-t-brand rounded-full animate-spin"></div>
          <span>Authenticating with Google...</span>
        </div>
      ) : (
        <div ref={googleBtnContainerRef} className="w-full flex justify-center"></div>
      )}
    </div>
  );
}
