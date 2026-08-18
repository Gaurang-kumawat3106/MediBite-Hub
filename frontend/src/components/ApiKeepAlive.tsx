"use client";

import { useEffect } from "react";

const HEALTH_PING_MS = 8 * 60 * 1000;

export default function ApiKeepAlive() {
  useEffect(() => {
    const ping = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        await fetch(`${apiUrl}/health/`, {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
          credentials: "include",
        });
      } catch (error) {
        console.warn("Health ping failed:", error);
      }
    };

    ping();
    const timer = setInterval(ping, HEALTH_PING_MS);

    return () => clearInterval(timer);
  }, []);

  return null;
}
