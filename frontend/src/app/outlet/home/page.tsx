"use client";

import { useEffect, useState } from "react";
import OutletSidebar from "@/components/OutletSidebar";
import { fetchWithCache } from "@/lib/apiCache";
import { useWebSocket } from "@/hooks/useWebSocket";
import { getImageUrl, getApiUrl } from "@/lib/utils";

export default function OutletDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async (force = false) => {
    try {
      const json = await fetchWithCache<any>(`${getApiUrl()}/app/outlet/home/`, force);
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
    fetchDashboardData();
  }, []);

  useWebSocket("/ws/orders/", (wsData) => {
    if (wsData.type === 'new_order' || wsData.type === 'order_update' || wsData.type === 'token_update') {
      fetchDashboardData(true);
    }
  });

  return (
    <div className="min-h-screen bg-[#faf9f6] flex">
      <OutletSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto">
          {loading && !data ? (
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl skeleton-shimmer shrink-0"></div>
                <div className="space-y-2">
                  <div className="w-48 h-6 rounded-lg skeleton-shimmer"></div>
                  <div className="w-32 h-4 rounded skeleton-shimmer"></div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-3">
                    <div className="w-12 h-12 rounded-xl skeleton-shimmer"></div>
                    <div className="w-24 h-4 rounded skeleton-shimmer"></div>
                    <div className="w-16 h-8 rounded skeleton-shimmer"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 bg-white rounded-2xl border border-gray-100 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                  {data?.outlet?.logo_url ? (
                    <img src={getImageUrl(data.outlet.logo_url, 160) as string} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <i className="fa-solid fa-store text-2xl text-gray-300"></i>
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold font-heading text-[#2b1b10]">{data?.outlet?.name}</h1>
                  <p className="text-gray-500">Welcome back, {data?.username}</p>
                </div>
              </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {/* Orders summary */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center mb-4 text-xl">
                <i className="fa-solid fa-receipt"></i>
              </div>
              <h3 className="text-gray-500 font-bold uppercase tracking-wider text-xs mb-1">Live Orders</h3>
              <div className="text-3xl font-black text-[#2b1b10]">{data?.stats?.today_orders || 0}</div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <div className="w-12 h-12 bg-green-50 text-green-500 rounded-xl flex items-center justify-center mb-4 text-xl">
                <i className="fa-solid fa-indian-rupee-sign"></i>
              </div>
              <h3 className="text-gray-500 font-bold uppercase tracking-wider text-xs mb-1">Today Revenue</h3>
              <div className="text-3xl font-black text-[#2b1b10]">₹{data?.stats?.today_collection || 0}</div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <div className="w-12 h-12 bg-orange-50 text-brand rounded-xl flex items-center justify-center mb-4 text-xl">
                <i className="fa-solid fa-chart-line"></i>
              </div>
              <h3 className="text-gray-500 font-bold uppercase tracking-wider text-xs mb-1">This Week</h3>
              <div className="text-3xl font-black text-[#2b1b10]">₹{data?.stats?.week_collection || 0}</div>
            </div>
          
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center mb-4 text-xl">
                <i className="fa-solid fa-calendar-days"></i>
              </div>
              <h3 className="text-gray-500 font-bold uppercase tracking-wider text-xs mb-1">This Month</h3>
              <div className="text-3xl font-black text-[#2b1b10]">₹{data?.stats?.month_collection || 0}</div>
            </div>
          </div>
          </>
          )}
        </div>
      </main>
    </div>
  );
}