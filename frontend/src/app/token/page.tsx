"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Footer from "@/components/Footer";
import { fetchWithCache } from "@/lib/apiCache";
import { useWebSocket } from "@/hooks/useWebSocket";
import { getApiUrl } from "@/lib/utils";

interface PopupToken {
  id: number;
  token_number: string;
  token?: string;
  outlet_name: string;
  remaining_seconds: number;
}

interface TokenData {
  success: boolean;
  tokens: PopupToken[];
  popup_token: PopupToken | null;
}

export default function TokenPage() {
  const [data, setData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPopup, setShowPopup] = useState(false);

  // We maintain client-side timers for live countdown
  const [timers, setTimers] = useState<Record<number, number>>({});

  const fetchTokens = async (force = false) => {
    try {
      const json = await fetchWithCache<TokenData>(`${getApiUrl()}/app/customer/token/`, force);
      if (json.success) {
        setData(json);
        
        // Initialize timers
        const newTimers: Record<number, number> = {};
        json.tokens.forEach((t: PopupToken) => {
          newTimers[t.id] = t.remaining_seconds;
        });
        setTimers(newTimers);

        if (json.popup_token) {
          setShowPopup(true);
        }
      } else {
        setError("Failed to load tokens.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  useWebSocket("/ws/orders/", (wsData) => {
    if (wsData.type === 'token_update' || wsData.type === 'order_update') {
      fetchTokens(true);
    }
  });

  // Countdown effect
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const next = { ...prev };
        let changed = false;
        for (const id in next) {
          if (next[id] > 0) {
            next[id] -= 1;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (totalSeconds: number) => {
    if (totalSeconds <= 0) return "Expired";
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    
    if (h > 0) {
      return `${h}h ${m}m ${s}s`;
    }
    return `${m}m ${s}s`;
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
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center justify-between">
              <div className="space-y-2">
                <div className="w-32 h-6 rounded-lg skeleton-shimmer"></div>
                <div className="w-24 h-4 rounded skeleton-shimmer"></div>
              </div>
              <div className="w-24 h-12 rounded-2xl skeleton-shimmer"></div>
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
          <i className="fa-solid fa-ticket text-brand mr-2"></i> My Tokens
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
            <h3 className="font-bold font-heading text-2xl text-[#2b1b10] mb-2">New Token Received!</h3>
            <p className="text-gray-500 mb-6">Your order at <span className="font-bold text-[#2b1b10]">{data.popup_token.outlet_name}</span> is ready.</p>
            
            <div className="bg-orange-50 border border-brand/20 rounded-2xl p-4 mb-6">
              <div className="text-xs uppercase font-bold text-brand tracking-wider mb-1">Your Token Number</div>
              <div className="text-4xl font-black text-[#2b1b10] font-heading tracking-widest">{data.popup_token.token_number}</div>
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
        {data?.tokens && data.tokens.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.tokens.map(token => {
              const secondsLeft = timers[token.id] || 0;
              const isWarning = secondsLeft > 0 && secondsLeft < 600; // Less than 10 mins

              return (
                <div key={token.id} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative overflow-hidden group hover:border-brand/30 transition-colors">
                  
                  {/* Decorative background element */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-[100px] -z-10 group-hover:scale-110 transition-transform"></div>
                  
                  <div className="flex justify-between items-start mb-6 z-10">
                    <div>
                      <div className="text-xs uppercase font-bold text-gray-400 tracking-wider mb-1">Outlet</div>
                      <div className="font-bold text-lg text-[#2b1b10]">{token.outlet_name}</div>
                    </div>
                    <div className="w-10 h-10 bg-orange-50 text-brand rounded-full flex items-center justify-center">
                      <i className="fa-solid fa-ticket"></i>
                    </div>
                  </div>

                  <div className="text-center py-4 bg-[#faf9f6] rounded-2xl border border-gray-100 mb-6">
                    <div className="text-xs uppercase font-bold text-brand tracking-wider mb-1">Token Number</div>
                    <div className="text-4xl font-black text-[#2b1b10] font-heading tracking-widest">{token.token_number}</div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-gray-500">Expires in:</span>
                    {secondsLeft > 0 ? (
                      <span className={`font-bold font-mono px-3 py-1 rounded-full ${isWarning ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        {formatTime(secondsLeft)}
                      </span>
                    ) : (
                      <span className="font-bold text-gray-400 px-3 py-1 bg-gray-50 rounded-full">Expired</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-20 px-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center text-brand text-4xl mb-6">
              <i className="fa-solid fa-ticket"></i>
            </div>
            <h2 className="text-2xl font-bold font-heading text-[#2b1b10] mb-2">No active tokens</h2>
            <p className="text-gray-500 mb-8 max-w-sm">When your orders are completed, you'll receive pickup tokens here.</p>
            <Link href="/orders" className="bg-brand text-white px-8 py-4 rounded-2xl font-bold hover:bg-brand-dark hover:shadow-lg hover:-translate-y-0.5 transition-all">
              View Past Orders
            </Link>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
