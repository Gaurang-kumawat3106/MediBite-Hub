"use client";

import { useEffect, useState, useRef } from "react";

export interface OrderTimerInfo {
  remainingSeconds: number;
  formattedTime: string;
  isOverdue: boolean;
}

export function useOrderReadyTimer(
  orders: any[],
  defaultPrepTimeMins: number = 20,
  onAutoMarkReady?: (orderId: number) => void
) {
  const [timers, setTimers] = useState<Record<number, OrderTimerInfo>>({});
  const autoMarkedSetRef = useRef<Set<number>>(new Set());

  const onAutoMarkReadyRef = useRef(onAutoMarkReady);
  onAutoMarkReadyRef.current = onAutoMarkReady;

  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  const prepTimeMinsRef = useRef(defaultPrepTimeMins);
  prepTimeMinsRef.current = defaultPrepTimeMins;

  useEffect(() => {
    const updateTimers = () => {
      const currentOrders = ordersRef.current;
      const currentPrepMins = prepTimeMinsRef.current;

      if (!Array.isArray(currentOrders) || currentOrders.length === 0) {
        setTimers((prev) => (Object.keys(prev).length === 0 ? prev : {}));
        return;
      }

      const newTimers: Record<number, OrderTimerInfo> = {};
      const nowMs = Date.now();
      const targetPrepSec = (currentPrepMins || 20) * 60;

      currentOrders.forEach((order) => {
        if (order.status === "preparing") {
          const startTimeMs = order.created_at ? new Date(order.created_at).getTime() : nowMs;
          const elapsedSec = Math.floor((nowMs - startTimeMs) / 1000);
          const remainingSec = targetPrepSec - elapsedSec;

          const isOverdue = remainingSec <= 0;
          let formattedTime = "";

          if (isOverdue) {
            const overdueSec = Math.abs(remainingSec);
            const mins = Math.floor(overdueSec / 60);
            const secs = overdueSec % 60;
            formattedTime = `+${mins}:${secs < 10 ? "0" : ""}${secs} overdue`;
          } else {
            const mins = Math.floor(remainingSec / 60);
            const secs = remainingSec % 60;
            formattedTime = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
          }

          newTimers[order.id] = {
            remainingSeconds: remainingSec,
            formattedTime,
            isOverdue,
          };

          // Auto mark ready when prep timer expires
          if (remainingSec <= 0 && !autoMarkedSetRef.current.has(order.id)) {
            autoMarkedSetRef.current.add(order.id);
            if (onAutoMarkReadyRef.current) {
              console.log(`⏱️ Prep timer expired for Order #${order.id}. Triggering auto-ready...`);
              onAutoMarkReadyRef.current(order.id);
            }
          }
        }
      });

      setTimers((prev) => {
        const prevKeys = Object.keys(prev);
        const newKeys = Object.keys(newTimers);
        if (prevKeys.length !== newKeys.length) return newTimers;

        let hasChanged = false;
        for (const key of newKeys) {
          const k = Number(key);
          if (
            !prev[k] ||
            prev[k].formattedTime !== newTimers[k].formattedTime ||
            prev[k].isOverdue !== newTimers[k].isOverdue
          ) {
            hasChanged = true;
            break;
          }
        }
        return hasChanged ? newTimers : prev;
      });
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, []);

  return timers;
}
