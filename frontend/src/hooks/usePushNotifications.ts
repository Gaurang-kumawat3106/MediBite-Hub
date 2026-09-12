"use client";

import { useEffect, useState, useCallback } from "react";
import { getApiUrl } from "@/lib/utils";
import { fetchWithCSRF, getSessionKeyHeader } from "@/lib/csrf";


function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check support and register Service Worker on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);

    if (!supported) {
      setLoading(false);
      return;
    }

    setPermission(Notification.permission);

    // Register service worker /sw.js
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        return registration.pushManager.getSubscription();
      })
      .then(async (subscription) => {
        if (subscription) {
          setIsSubscribed(true);
          // Sync existing browser subscription with backend to ensure request.user in Django DB is linked
          try {
            const rawSub = subscription.toJSON();
            const p256dhKey = subscription.getKey
              ? btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("p256dh") || new ArrayBuffer(0))))
              : rawSub.keys?.p256dh;
            const authKey = subscription.getKey
              ? btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("auth") || new ArrayBuffer(0))))
              : rawSub.keys?.auth;

            await fetchWithCSRF(`${getApiUrl()}/app/push/subscribe/`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              credentials: "include",
              body: JSON.stringify({
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: p256dhKey || rawSub.keys?.p256dh,
                  auth: authKey || rawSub.keys?.auth,
                },
              }),
            });
          } catch (syncErr) {
            console.warn("Failed to auto-sync push subscription with backend:", syncErr);
          }
        } else {
          setIsSubscribed(false);
        }
      })
      .catch((err) => {
        console.warn("Service Worker registration or subscription check failed:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const subscribeUser = useCallback(async () => {
    if (!isSupported) {
      setError("Push notifications are not supported on this browser.");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Request notification permission
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") {
        setError("Notification permission was not granted.");
        setLoading(false);
        return false;
      }

      // 2. Obtain VAPID Public Key (Environment variable or Backend Endpoint)
      let vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        const keyRes = await fetch(`${getApiUrl()}/app/push/vapid-key/`, {
          headers: {
            Accept: "application/json",
            ...getSessionKeyHeader(),
          },
          credentials: "include",
        });
        const keyData = await keyRes.json();
        if (keyData.success && keyData.vapid_public_key) {
          vapidPublicKey = keyData.vapid_public_key;
        }
      }

      if (!vapidPublicKey) {
        throw new Error("Failed to retrieve VAPID public key.");
      }

      // 3. Register fresh subscription (unsubscribing any stale subscription first)
      const registration = await navigator.serviceWorker.ready;
      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        try {
          await existingSub.unsubscribe();
        } catch (unsubErr) {
          console.warn("Unsubscribing stale push subscription warning:", unsubErr);
        }
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource,
      });

      // 4. Extract keys and send subscription JSON payload to backend
      const rawSub = subscription.toJSON();
      const p256dhKey = subscription.getKey
        ? btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("p256dh") || new ArrayBuffer(0))))
        : rawSub.keys?.p256dh;
      const authKey = subscription.getKey
        ? btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("auth") || new ArrayBuffer(0))))
        : rawSub.keys?.auth;

      const subRes = await fetchWithCSRF(`${getApiUrl()}/app/push/subscribe/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: p256dhKey || rawSub.keys?.p256dh,
            auth: authKey || rawSub.keys?.auth,
          },
        }),
      });

      const subData = await subRes.json();
      if (!subData.success) {
        throw new Error(subData.error || "Failed to save subscription on server.");
      }

      setIsSubscribed(true);
      return true;

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error enabling notifications.";
      console.error("subscribeUser error:", err);
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const unsubscribeUser = useCallback(async () => {
    if (!isSupported) return false;

    setLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // Notify backend to remove subscription
        await fetchWithCSRF(`${getApiUrl()}/app/push/unsubscribe/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ endpoint }),
        });
      }


      setIsSubscribed(false);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error disabling notifications.";
      console.error("unsubscribeUser error:", err);
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  return {
    permission,
    isSubscribed,
    isSupported,
    loading,
    error,
    subscribeUser,
    unsubscribeUser,
  };
}
