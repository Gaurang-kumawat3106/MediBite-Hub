"use client";

import { useEffect, useState } from "react";
import OutletSidebar from "@/components/OutletSidebar";
import { fetchWithCache } from "@/lib/apiCache";
import { useWebSocket } from "@/hooks/useWebSocket";
import { getApiUrl } from "@/lib/utils";

export default function DeliveredOrders() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const fetchOrders = async (currentFilter: string, force = false) => {
    try {
      if (!data) setLoading(true);
      const json = await fetchWithCache<any>(`${getApiUrl()}/app/outlet/orders/delivered/?time_filter=${currentFilter}`, force);
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
    if (wsData.type === 'order_update') {
      fetchOrders(filter, true);
    }
  });

  useEffect(() => {
    fetchOrders(filter, true);
  }, [filter]);

  const formatDate = (isoString: string | null) => {
    if (!isoString) return "N/A";
    const d = new Date(isoString);
    return d.toLocaleString(undefined, { 
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
    });
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] flex">
      <OutletSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <h1 className="text-2xl font-bold font-heading text-[#2b1b10]">Order History</h1>
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-[#2b1b10] outline-none focus:border-brand"
            >
              <option value="all">All Time</option>
              <option value="1h">Past 1 Hour</option>
              <option value="3h">Past 3 Hours</option>
              <option value="6h">Past 6 Hours</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
            </select>
          </div>

          {loading && !data ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="w-32 h-6 rounded-lg skeleton-shimmer"></div>
                    <div className="w-48 h-4 rounded skeleton-shimmer"></div>
                    <div className="w-40 h-4 rounded skeleton-shimmer"></div>
                  </div>
                  <div className="w-24 h-8 rounded-xl skeleton-shimmer md:self-end"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {data?.orders?.length > 0 ? data.orders.map((order: any) => (
                <div key={order.id} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-lg text-[#2b1b10]">Order #{order.id}</span>
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold uppercase tracking-wider border border-gray-200">
                        {order.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mb-2">
                      Customer: <span className="font-bold text-[#2b1b10]">{order.customer_name}</span>
                    </div>
                    <div className="text-sm text-gray-400">
                      <i className="fa-regular fa-clock w-4 text-center"></i> Delivered: {formatDate(order.completed_at)}
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:items-end justify-between">
                    <div className="font-bold text-xl text-[#2b1b10] mb-3">₹{order.total_price ?? order.total_amount ?? 0}</div>
                    <div className="text-xs text-gray-500 max-w-xs text-right">
                      {order.items?.map((i: any) => `${i.quantity}x ${i.product_name || i.name}`).join(", ")}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
                  <i className="fa-solid fa-clock-rotate-left text-4xl text-gray-300 mb-4"></i>
                  <h3 className="text-lg font-bold text-gray-500">No completed orders found</h3>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
