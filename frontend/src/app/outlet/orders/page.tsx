"use client";

import { useEffect, useState } from "react";
import OutletSidebar from "@/components/OutletSidebar";
import { fetchWithCache, invalidateCache } from "@/lib/apiCache";
import { fetchWithCSRF } from "@/lib/csrf";
import { useWebSocket } from "@/hooks/useWebSocket";
import { getApiUrl } from "@/lib/utils";
import toast, { Toaster } from "react-hot-toast";

export default function OutletOrders() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchOrders = async (force = false) => {
    try {
      const json = await fetchWithCache<any>(`${getApiUrl()}/app/outlet/orders/`, force);
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useWebSocket("/ws/orders/", (wsData) => {
    if (wsData.type === 'new_order' || wsData.type === 'order_update' || wsData.type === 'token_update') {
      fetchOrders(true);
    }
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateStatus = async (orderId: number, status: string) => {
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
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold font-heading text-[#2b1b10]">Live Orders</h1>
            <button onClick={() => fetchOrders(true)} className="text-gray-500 hover:text-brand bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2 text-sm font-bold transition-colors">
              <i className="fa-solid fa-rotate-right"></i> Refresh
            </button>
          </div>

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

                return (
                  <div key={order.id} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-start justify-between border-b border-gray-100 pb-4 mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-lg text-[#2b1b10]">Order #{order.id}</span>
                          {getStatusBadge(order.status)}
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

                    <div className="flex gap-2 justify-end">
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