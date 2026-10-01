"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import PushNotificationToggle from "@/components/PushNotificationToggle";
import { fetchWithCache, prefetchAPI, invalidateAllCache } from "@/lib/apiCache";
import { fetchWithCSRF } from "@/lib/csrf";
import { getImageUrl, getApiUrl } from "@/lib/utils";
import { useWebSocket } from "@/hooks/useWebSocket";

const Footer = dynamic(() => import("@/components/Footer"), { ssr: false });

interface Outlet {
  id: number;
  name: string;
  logo_url: string | null;
  is_accepting_orders?: boolean;
}

interface HomeData {
  success: boolean;
  outlets: Outlet[];
  username: string;
  msg?: string;
}

const CARD_GRADIENTS = [
  "from-[#aa5636] via-[#bc6943] to-[#d8874f]",
  "from-[#265343] via-[#376957] to-[#4e8672]",
  "from-[#7c4465] via-[#94527a] to-[#ae6591]",
  "from-[#3a506b] via-[#4c6888] to-[#6384aa]",
];

export default function CustomerHomePage() {
  const router = useRouter();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fetchRef = useRef(false);

  const handleLogout = async () => {
    try {
      await fetchWithCSRF(`${getApiUrl()}/app/logout/`, {
        method: "POST",
        headers: { "Accept": "application/json" },
        credentials: "include"
      });
    } catch (e) {
      console.error(e);
    } finally {
      localStorage.removeItem("bb_session_key");
      localStorage.removeItem("bb_username");
      invalidateAllCache();
      router.replace("/login");
    }
  };

  const fetchData = async (force = false) => {
    try {
      const json = await fetchWithCache<HomeData>(`${getApiUrl()}/app/customer/home/`, force);
      if (json.success) {
        setData(json);
        if (json.outlets && Array.isArray(json.outlets)) {
          json.outlets.forEach((o) => {
            prefetchAPI(`${getApiUrl()}/app/outlet/${o.id}/`);
          });
        }
        prefetchAPI(`${getApiUrl()}/app/cart/`);
      } else {
        setError(json.msg || "Failed to load outlets.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Please make sure the Django server is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fetchRef.current) return;
    fetchRef.current = true;
    fetchData();
  }, []);

  useWebSocket("/ws/orders/", (wsData) => {
    if (wsData.type === 'outlet_status_update') {
      fetchData(true);
    }
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#f6f3ed] flex flex-col items-center">
        {/* Header Skeleton */}
        <div className="w-full bg-[#13382c] rounded-b-[2.5rem] px-6 pt-6 pb-16 flex flex-col items-center">
          <div className="w-full max-w-4xl flex items-center justify-between mb-8">
            <div className="w-36 h-7 rounded-xl skeleton-shimmer bg-white/10"></div>
            <div className="w-24 h-8 rounded-full skeleton-shimmer bg-white/10"></div>
          </div>
          <div className="w-full max-w-4xl space-y-3">
            <div className="w-24 h-4 rounded skeleton-shimmer bg-white/10"></div>
            <div className="w-64 h-10 rounded-2xl skeleton-shimmer bg-white/10"></div>
            <div className="w-48 h-5 rounded skeleton-shimmer bg-white/10"></div>
          </div>
        </div>

        {/* Action Cards Skeleton */}
        <div className="w-full max-w-4xl px-6 -mt-8 flex gap-4">
          <div className="flex-1 h-20 rounded-[1.8rem] skeleton-shimmer"></div>
          <div className="flex-1 h-20 rounded-[1.8rem] skeleton-shimmer"></div>
        </div>

        {/* Cards Skeleton */}
        <div className="w-full max-w-4xl px-6 py-12">
          <div className="w-36 h-7 rounded-xl skeleton-shimmer mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-[2.2rem] p-4 space-y-4 shadow-sm border border-gray-100">
                <div className="w-full h-60 rounded-[1.8rem] skeleton-shimmer"></div>
                <div className="w-3/4 h-7 rounded-xl skeleton-shimmer"></div>
                <div className="w-1/2 h-4 rounded-lg skeleton-shimmer"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f6f3ed] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center text-3xl mb-4">
          <i className="fa-solid fa-triangle-exclamation"></i>
        </div>
        <h2 className="font-serif text-2xl font-bold text-[#13382c] mb-2">Something went wrong</h2>
        <p className="text-gray-500 mb-6 max-w-sm text-sm">{error}</p>
        <Link href="/login" className="bg-[#13382c] text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-[#1a4a3b] transition-all">
          Return to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f3ed] flex flex-col items-center font-sans selection:bg-[#e8a135]/30">
      
      {/* ─── Top Forest Green Header ─────────────────────────── */}
      <header className="w-full bg-[#13382c] rounded-b-[2.5rem] sm:rounded-b-[3.2rem] px-6 sm:px-8 pt-6 pb-16 flex flex-col items-center shadow-md">
        
        {/* Header Navigation */}
        <div className="w-full max-w-4xl flex items-center justify-between mb-8">
          
          {/* Logo */}
          <Link href="/customer/home" className="flex items-center gap-2.5 group">
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-white/95 p-1 flex items-center justify-center shadow-md border border-white/40 group-hover:scale-105 transition-transform shrink-0">
              <img src="/logo.png" alt="Bhukkad Box Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-serif font-bold text-2xl sm:text-3xl tracking-tight text-white">
              Bhukkad <span className="text-[#e8a135]">Box</span>
            </span>
          </Link>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            <PushNotificationToggle compact roleLabel="ready order updates" />
            <button
              onClick={handleLogout}
              className="bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-full border border-white/20 backdrop-blur-md flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
              Log out
            </button>
          </div>
        </div>

        {/* Greeting Banner */}
        <div className="w-full max-w-4xl text-left">
          <p className="text-[#a8c9bd] text-xs sm:text-sm font-medium tracking-wide mb-1">
            {getGreeting()}
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
            Hello, <span className="text-[#e8a135]">{data?.username || "Friend"}</span>
          </h1>
          <p className="text-[#bce0d4] text-sm sm:text-base mt-2 font-normal">
            Which kitchen are you craving today?
          </p>
        </div>

      </header>

      {/* ─── Overlapping Quick Action Cards ───────────────────── */}
      <div className="w-full max-w-4xl px-6 sm:px-8 -mt-9 relative z-20 grid grid-cols-2 gap-3.5 sm:gap-4">
        
        {/* Card 1: My Orders */}
        <Link 
          href="/orders" 
          className="bg-white rounded-[1.8rem] p-3 sm:p-4 shadow-[0_10px_25px_rgba(0,0,0,0.06)] border border-gray-100 flex items-center gap-2.5 sm:gap-3 hover:shadow-xl hover:-translate-y-0.5 transition-all group"
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#f4f2eb] text-[#13382c] flex items-center justify-center shrink-0 border border-gray-200/50 group-hover:bg-[#13382c] group-hover:text-white transition-colors">
            <i className="fa-solid fa-bag-shopping text-sm sm:text-lg"></i>
          </div>
          <div className="flex flex-col">
            <h2 className="font-bold text-[#13382c] text-xs sm:text-base leading-tight group-hover:text-[#e8a135] transition-colors whitespace-nowrap">
              My Orders
            </h2>
            <p className="text-[10px] sm:text-xs text-gray-400 font-medium mt-0.5 whitespace-nowrap">
              Track & reorder
            </p>
          </div>
        </Link>

        {/* Card 2: My Token */}
        <Link 
          href="/token" 
          className="bg-[#e8a135] rounded-[1.8rem] p-3 sm:p-4 shadow-[0_10px_25px_rgba(232,161,53,0.28)] flex items-center gap-2.5 sm:gap-3 hover:shadow-xl hover:-translate-y-0.5 transition-all group"
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#d48e28] text-[#13382c] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <i className="fa-solid fa-ticket text-sm sm:text-lg"></i>
          </div>
          <div className="flex flex-col">
            <h2 className="font-bold text-[#13382c] text-xs sm:text-base leading-tight whitespace-nowrap">
              My Token
            </h2>
            <p className="text-[10px] sm:text-xs text-[#523812] font-medium mt-0.5 whitespace-nowrap">
              Show at counter
            </p>
          </div>
        </Link>

      </div>

      {/* ─── Kitchens Section Header ─────────────────────────── */}
      <div className="w-full max-w-4xl px-6 sm:px-8 mt-10 mb-5 flex items-center justify-between">
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#13382c] tracking-tight">
          Pick a kitchen
        </h2>
        <span className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider">
          {data?.outlets?.length || 0} {data?.outlets?.length === 1 ? "kitchen" : "kitchens"}
        </span>
      </div>

      {/* ─── Outlets List ────────────────────────────────────── */}
      <div className="w-full max-w-4xl px-6 sm:px-8 pb-16">
        {data?.outlets && data.outlets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {data.outlets.map((outlet, index) => {
              const isClosed = outlet.is_accepting_orders === false;
              const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
              const outletNumber = String(index + 1).padStart(2, '0');

              return (
                <div 
                  key={outlet.id}
                  className="flex flex-col group"
                >
                  {/* Card Banner Container */}
                  <Link
                    href={`/outlet/${outlet.id}`}
                    onMouseEnter={() => prefetchAPI(`${getApiUrl()}/app/outlet/${outlet.id}/`)}
                    className={`relative h-64 sm:h-72 rounded-[2.2rem] overflow-hidden shadow-md bg-gradient-to-br ${gradient} p-5 flex flex-col justify-between group-hover:shadow-2xl transition-all duration-500 ${
                      isClosed ? "grayscale contrast-[0.95] opacity-85" : ""
                    }`}
                  >
                    {/* Top Row inside Banner */}
                    <div className="flex items-start justify-between z-10">
                      {/* Status Badge */}
                      <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm backdrop-blur-md ${
                        isClosed 
                          ? "bg-neutral-900/90 text-white" 
                          : "bg-white/95 text-[#13382c]"
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${isClosed ? "bg-red-500" : "bg-emerald-500 animate-pulse"}`}></span>
                        {isClosed ? "Closed" : "Open now"}
                      </div>

                      {/* Gold Corner Ribbon */}
                      <div className="w-12 h-12 bg-[#e8a135] rounded-bl-3xl shadow-sm -mr-5 -mt-5"></div>
                    </div>

                    {/* Centered Outlet Stall Image covering 70% of the card from center */}
                    <div className="absolute inset-0 flex items-center justify-center p-3 z-0 pointer-events-none">
                      <div className="w-[72%] h-[68%] rounded-[1.6rem] bg-white p-1 shadow-2xl border-4 border-white/80 overflow-hidden group-hover:scale-105 transition-transform duration-500">
                        <img
                          src={outlet.logo_url ? (getImageUrl(outlet.logo_url, 600) as string) : "/pyarelal_stall.jpg"}
                          alt={outlet.name}
                          className="w-full h-full object-cover rounded-[1.2rem]"
                          loading="eager"
                          decoding="async"
                        />
                      </div>
                    </div>

                    {/* Bottom Row inside Banner */}
                    <div className="flex items-end justify-between z-10">
                      {/* Rating Badge */}
                      <div className="text-white font-bold text-xs sm:text-sm flex items-center gap-1 bg-black/25 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 shadow-sm">
                        <i className="fa-solid fa-star text-amber-300 text-xs"></i> 4.6
                      </div>

                      {/* Large Index Number */}
                      <div className="font-serif text-5xl sm:text-6xl font-black text-white/90 tracking-tighter drop-shadow-md leading-none select-none">
                        {outletNumber}
                      </div>
                    </div>
                  </Link>

                  {/* Below Card Details */}
                  <div className="pt-4 px-1">
                    <Link 
                      href={`/outlet/${outlet.id}`}
                      onMouseEnter={() => prefetchAPI(`${getApiUrl()}/app/outlet/${outlet.id}/`)}
                    >
                      <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#13382c] group-hover:text-[#e8a135] transition-colors leading-tight break-words line-clamp-2">
                        {outlet.name}
                      </h3>
                    </Link>
                    
                    <p className="text-xs sm:text-sm font-medium text-gray-400 mt-1 mb-4">
                      {isClosed ? "Currently not accepting orders" : "North Indian · Fast Food"}
                    </p>

                    {/* Card Footer Actions */}
                    <div className="flex items-center justify-between gap-2">
                      {/* Left Info Pills */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-white border border-gray-200/80 px-3 py-1.5 rounded-full text-xs font-bold text-[#13382c] flex items-center gap-1.5 shadow-sm whitespace-nowrap">
                          <i className="fa-regular fa-clock text-gray-400"></i>
                          20–25 min
                        </span>
                      </div>

                      {/* Right Explore Button */}
                      <Link 
                        href={`/outlet/${outlet.id}`}
                        onMouseEnter={() => prefetchAPI(`${getApiUrl()}/app/outlet/${outlet.id}/`)}
                        className={`text-xs sm:text-sm font-bold pl-4 pr-1.5 py-1.5 rounded-full flex items-center gap-2.5 shadow-sm transition-all whitespace-nowrap shrink-0 ${
                          isClosed 
                            ? "bg-gray-200 text-gray-500 cursor-not-allowed" 
                            : "bg-[#13382c] text-white hover:bg-[#1a4a3b] hover:shadow-md"
                        }`}
                      >
                        Explore
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-sm transition-transform group-hover:translate-x-0.5 shrink-0 ${
                          isClosed ? "bg-gray-300 text-gray-600" : "bg-[#e8a135] text-[#13382c]"
                        }`}>
                          <i className="fa-solid fa-arrow-right"></i>
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-[2.2rem] border border-gray-100 p-12 flex flex-col items-center justify-center text-center shadow-sm">
            <div className="w-16 h-16 bg-[#13382c]/10 text-[#13382c] rounded-full flex items-center justify-center text-2xl mb-4">
              <i className="fa-solid fa-store-slash"></i>
            </div>
            <h3 className="font-serif text-xl font-bold text-[#13382c] mb-2">No kitchens available</h3>
            <p className="text-gray-400 text-sm">Please check back soon for new food outlets!</p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
