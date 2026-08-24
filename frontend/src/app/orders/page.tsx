"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Footer from "@/components/Footer";
import { fetchWithCache } from "@/lib/apiCache";
import { fetchWithCSRF } from "@/lib/csrf";
import { useWebSocket } from "@/hooks/useWebSocket";
import { getApiUrl } from "@/lib/utils";

interface OrderItem {
  id: number;
  product_name?: string;
  name?: string;
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  created_at: string;
  completed_at?: string | null;
  status: string;
  payment_status: string;
  total_price?: number;
  total_amount?: number;
  token_number?: string | null;
  token?: string | null;
  outlet_name: string | null;
  items?: OrderItem[];
}

interface PopupToken {
  id: number;
  token_number: string;
  token?: string;
  outlet_name: string;
  remaining_seconds: number;
}

interface OrdersData {
  success: boolean;
  orders: Order[];
  popup_token: PopupToken | null;
}

export default function OrdersPage() {
  const router = useRouter();
  const [data, setData] = useState<OrdersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPopup, setShowPopup] = useState(false);

  const fetchOrders = async (force = false) => {
    try {
      const json = await fetchWithCache<OrdersData>(`${getApiUrl()}/app/customer/orders/`, force);
      if (json.success) {
        setData(json);
        if (json.popup_token) {
          setShowPopup(true);
        }
      } else {
        setError("Failed to load orders.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  useWebSocket("/ws/orders/", (wsData) => {
    if (wsData.type === 'order_update' || wsData.type === 'token_update') {
      fetchOrders(true);
    }
  });

  const handleCancel = async (orderId: number) => {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    try {
      setLoading(true);
      await fetchWithCSRF(`${getApiUrl()}/app/customer/order/${orderId}/cancel/`, {
        method: "POST",
        headers: { "Accept": "application/json" },
        credentials: "include"
      });
      await fetchOrders(true);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleReorder = async (orderId: number) => {
    try {
      setLoading(true);
      await fetchWithCSRF(`${getApiUrl()}/app/customer/order/${orderId}/reorder/`, {
        method: "POST",
        headers: { "Accept": "application/json" },
        credentials: "include"
      });
      router.push("/cart");
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, { 
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'cancelled': return 'text-red-600 bg-red-50 border-red-200';
      case 'preparing': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'ready': return 'text-brand bg-orange-50 border-orange-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#faf9f6] flex flex-col">
        <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 flex items-center px-6 py-4">
          <div className="w-16 h-5 rounded-lg skeleton-shimmer"></div>
          <div className="flex-1 text-center">
            <div className="w-28 h-6 rounded-lg skeleton-shimmer mx-auto"></div>
          </div>
          <div className="w-16"></div>
        </nav>

        <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <div className="flex justify-between border-b border-gray-100 pb-4">
                <div className="space-y-2">
                  <div className="w-36 h-6 rounded-lg skeleton-shimmer"></div>
                  <div className="w-48 h-4 rounded skeleton-shimmer"></div>
                </div>
                <div className="w-20 h-6 rounded-full skeleton-shimmer"></div>
              </div>
              <div className="space-y-2">
                <div className="w-full h-4 rounded skeleton-shimmer"></div>
                <div className="w-3/4 h-4 rounded skeleton-shimmer"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col relative">
      
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 flex items-center px-6 py-4">
        <Link href="/customer/home" className="flex items-center gap-3 text-[#2b1b10] hover:text-brand transition-colors font-bold text-sm">
          <i className="fa-solid fa-arrow-left"></i> Home
        </Link>
        <div className="flex-1 text-center font-bold font-heading text-lg text-[#2b1b10]">
          <i className="fa-solid fa-clock-rotate-left text-brand mr-2"></i> My Orders
        </div>
        <div className="w-[60px]"></div>
      </nav>

      {/* Token Popup */}
      {showPopup && data?.popup_token && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-xl transform scale-100 animate-fade-in-up border border-gray-100">
            <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              <i className="fa-solid fa-check"></i>
            </div>
            <h3 className="font-bold font-heading text-2xl text-[#2b1b10] mb-2">Order Ready!</h3>
            <p className="text-gray-500 mb-6">Your order at <span className="font-bold text-[#2b1b10]">{data.popup_token.outlet_name}</span> is ready for pickup.</p>
            
            <div className="bg-orange-50 border border-brand/20 rounded-2xl p-4 mb-6">
              <div className="text-xs uppercase font-bold text-brand tracking-wider mb-1">Your Token Number</div>
              <div className="text-4xl font-black text-[#2b1b10] font-heading tracking-widest">{data.popup_token.token_number || data.popup_token.token}</div>
            </div>

            <button 
              onClick={() => setShowPopup(false)}
              className="w-full bg-[#2b1b10] text-white py-4 rounded-xl font-bold hover:bg-black transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-8">
        {data?.orders && data.orders.length > 0 ? (
          <div className="flex flex-col gap-4">
            {data.orders.map(order => {
              const displayTotal = order.total_price ?? order.total_amount ?? 0;
              const tokenNo = order.token_number || order.token;

              return (
                <div key={order.id} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-brand/30 transition-colors">
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="font-bold text-[#2b1b10] text-lg">Order #{order.id}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                      {tokenNo && (
                        <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-orange-50 text-brand border border-brand/20">
                          Token #{tokenNo}
                        </span>
                      )}
                    </div>
                    
                    <div className="text-gray-500 text-sm mb-1 flex items-center gap-2">
                      <i className="fa-solid fa-store w-4 text-center"></i> {order.outlet_name || "Unknown Outlet"}
                    </div>
                    <div className="text-gray-500 text-sm flex items-center gap-2 mb-3">
                      <i className="fa-regular fa-calendar w-4 text-center"></i> {formatDate(order.created_at)}
                    </div>

                    {order.items && order.items.length > 0 && (
                      <div className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3 border border-gray-100 flex flex-col gap-1">
                        {order.items.map(item => (
                          <div key={item.id} className="flex justify-between">
                            <span className="font-medium">{item.quantity}x {item.product_name || item.name}</span>
                            <span>₹{item.price * item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col md:items-end justify-between gap-4">
                    <div className="font-bold font-heading text-xl text-[#2b1b10]">
                      ₹{displayTotal}
                    </div>
                    
                    <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <button 
                          onClick={() => handleCancel(order.id)}
                          className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors border border-red-100"
                        >
                          Cancel
                        </button>
                      )}
                      {(order.status === 'completed' || order.status === 'cancelled') && (
                        <button 
                          onClick={() => handleReorder(order.id)}
                          className="px-4 py-2 text-sm font-bold text-brand bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors border border-brand/20 flex items-center gap-2"
                        >
                          <i className="fa-solid fa-rotate-right"></i> Reorder
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-20 px-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center text-brand text-4xl mb-6">
              <i className="fa-solid fa-receipt"></i>
            </div>
            <h2 className="text-2xl font-bold font-heading text-[#2b1b10] mb-2">No orders yet</h2>
            <p className="text-gray-500 mb-8 max-w-sm">When you place orders, they will appear here so you can track them.</p>
            <Link href="/customer/home" className="bg-brand text-white px-8 py-4 rounded-2xl font-bold hover:bg-brand-dark hover:shadow-lg hover:-translate-y-0.5 transition-all">
              Start Ordering
            </Link>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
