"use client";

import { useEffect, useState } from "react";
import OutletSidebar from "@/components/OutletSidebar";
import { fetchWithCache } from "@/lib/apiCache";

export default function OutletOrders() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const json = await fetchWithCache<any>(`${process.env.NEXT_PUBLIC_API_URL}/app/outlet/orders/`);
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // Polling every 10s
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (orderId: number, status: string) => {
    try {
      const formData = new URLSearchParams();
      formData.append("status", status);
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/app/outlet/order/${orderId}/update/`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        credentials: "include"
      });
      fetchOrders();
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "pending": return <span className="px-3 py-1 bg-yellow-50 text-yellow-600 rounded-full text-xs font-bold uppercase tracking-wider border border-yellow-200">Pending</span>;
      case "preparing": return <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-200">Preparing</span>;
      case "ready": return <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold uppercase tracking-wider border border-green-200">Ready</span>;
      default: return <span className="px-3 py-1 bg-gray-50 text-gray-600 rounded-full text-xs font-bold uppercase tracking-wider border border-gray-200">{status}</span>;
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#faf9f6] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand/20 border-t-brand rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f6] flex">
      <OutletSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold font-heading text-[#2b1b10]">Live Orders</h1>
            <button onClick={fetchOrders} className="text-gray-500 hover:text-brand bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2 text-sm font-bold transition-colors">
              <i className="fa-solid fa-rotate-right"></i> Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {data?.orders?.length > 0 ? data.orders.map((order: any) => (
              <div key={order.id} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between border-b border-gray-100 pb-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-lg text-[#2b1b10]">Order #{order.id}</span>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="text-sm text-gray-500">
                      Customer: <span className="font-bold text-[#2b1b10]">{order.customer_name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-[#2b1b10]">₹{order.total_price}</div>
                    {order.token && (
                      <div className="text-xs font-bold text-brand mt-1 bg-orange-50 px-2 py-1 rounded inline-block">
                        Token: {order.token}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-6 space-y-2">
                  {order.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <div className="font-medium text-[#2b1b10]">
                        <span className="text-gray-400 mr-2">{item.quantity}x</span>
                        {item.product_name}
                      </div>
                      <div className="text-gray-500">₹{item.price}</div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 justify-end">
                  {order.status === "pending" && (
                    <button onClick={() => handleUpdateStatus(order.id, "preparing")} className="px-6 py-2 bg-blue-500 text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-colors">
                      Start Preparing
                    </button>
                  )}
                  {order.status === "preparing" && (
                    <button onClick={() => handleUpdateStatus(order.id, "ready")} className="px-6 py-2 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 transition-colors">
                      Mark Ready
                    </button>
                  )}
                  {order.status === "ready" && (
                    <button onClick={() => handleUpdateStatus(order.id, "delivered")} className="px-6 py-2 bg-[#2b1b10] text-white rounded-xl font-bold text-sm hover:bg-black transition-colors">
                      Mark Delivered
                    </button>
                  )}
                </div>
              </div>
            )) : (
              <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
                <i className="fa-solid fa-receipt text-4xl text-gray-300 mb-4"></i>
                <h3 className="text-lg font-bold text-gray-500">No active orders</h3>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}