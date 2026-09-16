"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import OutletSidebar from "@/components/OutletSidebar";
import PushNotificationToggle from "@/components/PushNotificationToggle";
import OrderAcceptingToggle from "@/components/OrderAcceptingToggle";
import VoiceAlertToggle from "@/components/VoiceAlertToggle";
import { fetchWithCache, invalidateCache } from "@/lib/apiCache";

import { fetchWithCSRF } from "@/lib/csrf";
import { useWebSocket } from "@/hooks/useWebSocket";
import { getApiUrl } from "@/lib/utils";
import { announceNewOrder } from "@/lib/voiceAnnouncement";
import { receiptPrintQueue } from "@/lib/receiptPrinter";
import { useOrderReadyTimer } from "@/hooks/useOrderReadyTimer";
import toast, { Toaster } from "react-hot-toast";

export default function OutletOrders() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [defaultPrepTimeMins, setDefaultPrepTimeMins] = useState<number>(20);
  const [isEditingPrepTime, setIsEditingPrepTime] = useState<boolean>(false);
  const [prepTimeInput, setPrepTimeInput] = useState<string>("20");
  const [savingPrepTime, setSavingPrepTime] = useState<boolean>(false);

  const isFirstLoadRef = useRef(true);
  const knownOrderIdsRef = useRef<Set<number>>(new Set());

  const fetchOrders = async (force = false) => {
    try {
      const json = await fetchWithCache<any>(`${getApiUrl()}/app/outlet/orders/`, force);
      if (json.success && Array.isArray(json.orders)) {
        if (json.default_prep_time_mins) {
          setDefaultPrepTimeMins((prev) => (prev !== json.default_prep_time_mins ? json.default_prep_time_mins : prev));
          setPrepTimeInput((prev) => (prev !== String(json.default_prep_time_mins) ? String(json.default_prep_time_mins) : prev));
        }


        if (isFirstLoadRef.current) {
          json.orders.forEach((o: any) => knownOrderIdsRef.current.add(o.id));
          isFirstLoadRef.current = false;
        } else {
          // Detect any new paid orders fetched via polling
          json.orders.forEach((o: any) => {
            if (!knownOrderIdsRef.current.has(o.id)) {
              knownOrderIdsRef.current.add(o.id);
              if (o.status !== "cancelled" && o.status !== "delivered") {
                announceNewOrder({
                  order_id: o.id,
                  token_number: o.token_number || o.token,
                  items: o.items,
                });
                receiptPrintQueue.enqueueOrder({
                  id: o.id,
                  token_number: o.token_number || o.token,
                  customer_name: o.customer_name,
                  total_amount: o.total_amount || o.total_price,
                  items: o.items || [],
                });
              }
            }
          });
        }
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = useCallback(async (orderId: number, status: string) => {
    setUpdatingId(orderId);

    // Optimistic status update in React state
    setData((prev: any) => {
      if (!prev?.orders) return prev;
      if (status === 'delivered') {
        return {
          ...prev,
          orders: prev.orders.filter((o: any) => o.id !== orderId)
        };
      }
      return {
        ...prev,
        orders: prev.orders.map((o: any) => 
          o.id === orderId ? { ...o, status } : o
        )
      };
    });

    try {
      const formData = new URLSearchParams();
      formData.append("status", status);
      const res = await fetchWithCSRF(`${getApiUrl()}/app/outlet/order/${orderId}/update/`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        },
        credentials: "include",
        body: formData.toString()
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Order #${orderId} marked as ${status}`);
        invalidateCache(`${getApiUrl()}/app/outlet/orders/`);
        invalidateCache(`${getApiUrl()}/app/outlet/home/`);
        fetchOrders(true);
      } else {
        toast.error(json.error || "Failed to update status");
        fetchOrders(true);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to update status");
      fetchOrders(true);
    } finally {
      setUpdatingId(null);
    }
  }, []);

  // Hook for preparation timer countdown & auto-ready trigger
  const orderTimers = useOrderReadyTimer(
    data?.orders || [],
    defaultPrepTimeMins,
    (autoReadyOrderId) => {
      toast.success(`⏰ Prep timer expired for Order #${autoReadyOrderId}! Auto-marked READY.`, { duration: 6000 });
      handleUpdateStatus(autoReadyOrderId, "completed");
    }
  );

  useWebSocket("/ws/orders/", (wsData) => {
    if (wsData.type === 'new_order') {
      toast.success(`🔔 New Order #${wsData.order_id} received!`, { duration: 5000 });
      knownOrderIdsRef.current.add(wsData.order_id);
      
      // 1. Trigger Voice Announcement
      announceNewOrder({
        order_id: wsData.order_id,
        token_number: wsData.token_number,
        items_summary: wsData.items_summary,
        items: wsData.items,
      });

      // 2. Enqueue Thermal Receipt Print
      receiptPrintQueue.enqueueOrder({
        id: wsData.order_id,
        token_number: wsData.token_number,
        customer_name: wsData.customer_name,
        total_amount: wsData.total_amount,
        items: wsData.items || [],
      });

      fetchOrders(true);
    } else if (wsData.type === 'order_update') {
      fetchOrders(true);
    }
  });

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSavePrepTime = async () => {
    const val = parseInt(prepTimeInput, 10);
    if (isNaN(val) || val < 1 || val > 180) {
      toast.error("Please enter a valid preparation time (1 to 180 mins)");
      return;
    }

    setSavingPrepTime(true);
    try {
      const res = await fetchWithCSRF(`${getApiUrl()}/app/outlet/settings/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ default_prep_time_mins: val })
      });
      const json = await res.json();
      if (json.success) {
        setDefaultPrepTimeMins(json.default_prep_time_mins);
        setIsEditingPrepTime(false);
        toast.success(`Default prep time updated to ${json.default_prep_time_mins} mins`);
      } else {
        toast.error(json.error || "Failed to update prep time");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving prep time");
    } finally {
      setSavingPrepTime(false);
    }
  };

  const handleManualPrint = (order: any) => {
    const success = receiptPrintQueue.enqueueOrder({
      id: order.id,
      token_number: order.token_number || order.token,
      customer_name: order.customer_name,
      total_amount: order.total_price ?? order.total_amount,
      items: order.items || []
    });
    if (success) {
      toast.success(`Printing receipt for Order #${order.id}...`);
    } else {
      toast(`Receipt for Order #${order.id} was already printed or is in queue.`, { icon: '🖨️' });
    }

  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "pending": return <span className="px-3 py-1 bg-yellow-50 text-yellow-600 rounded-full text-xs font-bold uppercase tracking-wider border border-yellow-200">Pending</span>;
      case "preparing": return <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-200">Preparing</span>;
      case "completed": return <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold uppercase tracking-wider border border-green-200">Ready</span>;
      default: return <span className="px-3 py-1 bg-gray-50 text-gray-600 rounded-full text-xs font-bold uppercase tracking-wider border border-gray-200">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] flex">
      <Toaster position="bottom-right" />
      <OutletSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <h1 className="text-2xl font-bold font-heading text-[#2b1b10]">Live Orders</h1>
            <div className="flex flex-wrap items-center gap-3">
              <OrderAcceptingToggle compact />
              <PushNotificationToggle compact roleLabel="new paid order alerts" />
              <VoiceAlertToggle compact />
              <button onClick={() => fetchOrders(true)} className="text-gray-500 hover:text-brand bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2 text-sm font-bold transition-colors">
                <i className="fa-solid fa-rotate-right"></i> Refresh
              </button>
            </div>
          </div>

          {/* Preparation Time Configuration Bar */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-brand flex items-center justify-center font-bold text-lg border border-brand/20">
                <i className="fa-solid fa-clock"></i>
              </div>
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Default Prep Time</div>
                <div className="text-sm font-bold text-[#2b1b10]">
                  {defaultPrepTimeMins} Minutes <span className="text-xs font-normal text-gray-400">(Auto-marks orders ready when timer expires)</span>
                </div>
              </div>
            </div>

            {isEditingPrepTime ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={prepTimeInput}
                  onChange={(e) => setPrepTimeInput(e.target.value)}
                  className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-bold text-center focus:outline-none focus:border-brand"
                />
                <span className="text-xs text-gray-500 font-bold">mins</span>
                <button
                  onClick={handleSavePrepTime}
                  disabled={savingPrepTime}
                  className="px-4 py-1.5 bg-brand text-white text-xs font-bold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {savingPrepTime ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => {
                    setIsEditingPrepTime(false);
                    setPrepTimeInput(String(defaultPrepTimeMins));
                  }}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingPrepTime(true)}
                className="px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[#2b1b10] text-xs font-bold rounded-xl transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-pen-to-square"></i> Set Prep Time
              </button>
            )}
          </div>

          <PushNotificationToggle className="mb-6" roleLabel="new paid order alerts" />

          {loading && !data ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                  <div className="flex justify-between border-b border-gray-100 pb-4">
                    <div className="space-y-2">
                      <div className="w-32 h-6 rounded-lg skeleton-shimmer"></div>
                      <div className="w-48 h-4 rounded skeleton-shimmer"></div>
                    </div>
                    <div className="w-20 h-8 rounded-xl skeleton-shimmer"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="w-full h-4 rounded skeleton-shimmer"></div>
                    <div className="w-3/4 h-4 rounded skeleton-shimmer"></div>
                  </div>
                  <div className="flex justify-end">
                    <div className="w-32 h-10 rounded-xl skeleton-shimmer"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {data?.orders?.length > 0 ? data.orders.map((order: any) => {
                const displayTotal = order.total_price ?? order.total_amount ?? 0;
                const tokenNo = order.token_number || order.token;
                const isUpdating = updatingId === order.id;
                const timerInfo = orderTimers[order.id];

                return (
                  <div key={order.id} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-start justify-between border-b border-gray-100 pb-4 mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-lg text-[#2b1b10]">Order #{order.id}</span>
                          {getStatusBadge(order.status)}
                          {order.status === "preparing" && timerInfo && (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                              timerInfo.isOverdue 
                                ? "bg-red-50 text-red-600 border-red-200 animate-pulse" 
                                : "bg-blue-50 text-blue-600 border-blue-200"
                            }`}>
                              <i className="fa-solid fa-stopwatch"></i>
                              {timerInfo.formattedTime}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          Customer: <span className="font-bold text-[#2b1b10]">{order.customer_name || "Guest"}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-[#2b1b10]">₹{displayTotal}</div>
                        {tokenNo && (
                          <div className="text-xs font-black text-brand mt-1 bg-orange-50 px-2.5 py-1 rounded-lg border border-brand/20 inline-block">
                            Token #{tokenNo}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mb-6 space-y-2">
                      {order.items && order.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <div className="font-medium text-[#2b1b10]">
                            <span className="text-gray-400 mr-2">{item.quantity}x</span>
                            {item.product_name || item.name}
                          </div>
                          <div className="text-gray-500">₹{item.price}</div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <button
                        onClick={() => handleManualPrint(order)}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors flex items-center gap-2"
                        title="Print thermal receipt"
                      >
                        <i className="fa-solid fa-print"></i> Print Receipt
                      </button>

                      <div className="flex gap-2">
                        {order.status === "pending" && (
                          <button 
                            onClick={() => handleUpdateStatus(order.id, "preparing")} 
                            disabled={isUpdating}
                            className="px-6 py-2.5 bg-blue-500 text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-colors disabled:opacity-60 flex items-center gap-2"
                          >
                            {isUpdating && <i className="fa-solid fa-spinner fa-spin"></i>}
                            Start Preparing
                          </button>
                        )}
                        {order.status === "preparing" && (
                          <button 
                            onClick={() => handleUpdateStatus(order.id, "completed")} 
                            disabled={isUpdating}
                            className="px-6 py-2.5 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 transition-colors disabled:opacity-60 flex items-center gap-2"
                          >
                            {isUpdating && <i className="fa-solid fa-spinner fa-spin"></i>}
                            Mark Ready
                          </button>
                        )}
                        {order.status === "completed" && (
                          <button 
                            onClick={() => handleUpdateStatus(order.id, "delivered")} 
                            disabled={isUpdating}
                            className="px-6 py-2.5 bg-[#2b1b10] text-white rounded-xl font-bold text-sm hover:bg-black transition-colors disabled:opacity-60 flex items-center gap-2"
                          >
                            {isUpdating && <i className="fa-solid fa-spinner fa-spin"></i>}
                            Mark Delivered
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
                  <i className="fa-solid fa-receipt text-4xl text-gray-300 mb-4"></i>
                  <h3 className="text-lg font-bold text-gray-500">No active orders</h3>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
