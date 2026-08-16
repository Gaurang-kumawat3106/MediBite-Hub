"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { fetchWithCache, prefetchAPI } from "@/lib/apiCache";
import { fetchWithCSRF } from "@/lib/csrf";

const Footer = dynamic(() => import("@/components/Footer"), { ssr: false });

const getImageUrl = (url: string | null) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${process.env.NEXT_PUBLIC_API_URL}${url}`;
};

interface Outlet {
  id: number;
  name: string;
  logo_url: string | null;
}

interface HomeData {
  success: boolean;
  outlets: Outlet[];
  username: string;
  msg?: string;
}

export default function CustomerHomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fetchRef = useRef(false);

  const handleLogout = async () => {
    try {
      await fetchWithCSRF(`${process.env.NEXT_PUBLIC_API_URL}/app/logout/`, {
        method: "POST",
        headers: { "Accept": "application/json" },
        credentials: "include"
      });
      window.location.href = "/login";
    } catch (e) {
      console.error(e);
      window.location.href = "/login";
    }
  };

  useEffect(() => {
    if (fetchRef.current) return;
    fetchRef.current = true;

    async function fetchData() {
      try {
        const json = await fetchWithCache<HomeData>(`${process.env.NEXT_PUBLIC_API_URL}/app/customer/home/`);
        if (json.success) {
          setData(json);
        } else {
          setError(json.msg || "Failed to load outlets.");
        }
      } catch (err) {
        console.error(err);
        setError("Network error. Please make sure the Django server is running.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f6] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand/20 border-t-brand rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#faf9f6] flex flex-col items-center justify-center p-6 text-center">
        <i className="fa-solid fa-circle-exclamation text-4xl text-red-400 mb-4"></i>
        <h2 className="text-xl font-bold text-[#2b1b10] mb-2">Oops!</h2>
        <p className="text-gray-500 mb-6">{error}</p>
        <Link href="/login" className="bg-brand text-white px-6 py-2 rounded-xl font-semibold hover:bg-brand-dark transition-colors">
          Return to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col items-center">
      
      {/* Navbar */}
      <nav className="w-full max-w-4xl px-6 py-4 flex items-center justify-between sticky top-0 bg-[#faf9f6]/90 backdrop-blur-md z-40 border-b border-gray-100/50">
        <Link href="/customer/home" className="text-xl font-bold font-heading text-brand flex items-center gap-2">
          <i className="fa-solid fa-utensils"></i> Bhukkad Box
        </Link>
        <div className="flex items-center gap-4">
          <span className="bg-orange-50 text-brand px-4 py-1.5 rounded-full text-sm font-semibold border border-orange-100">
            {data?.username}
          </span>
          <button className="text-gray-400 hover:text-gray-600 transition-colors" title="Settings">
            <i className="fa-solid fa-gear text-lg"></i>
          </button>
        </div>
      </nav>

      {/* Action Buttons */}
      <div className="w-full max-w-4xl px-6 py-4 flex flex-wrap gap-3">
        <Link href="/orders" className="flex-1 min-w-[120px] flex items-center justify-center gap-2 bg-white border border-gray-100 py-3 rounded-2xl text-sm font-bold text-[#2b1b10] shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:-translate-y-0.5 hover:shadow-md transition-all">
          <i className="fa-solid fa-receipt text-brand"></i> My Orders
        </Link>
        <Link href="/token" className="flex-1 min-w-[120px] flex items-center justify-center gap-2 bg-white border border-gray-100 py-3 rounded-2xl text-sm font-bold text-[#2b1b10] shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:-translate-y-0.5 hover:shadow-md transition-all">
          <i className="fa-solid fa-ticket text-brand"></i> My Token
        </Link>
        <button onClick={handleLogout} className="flex-1 min-w-[120px] flex items-center justify-center gap-2 bg-white border border-gray-100 py-3 rounded-2xl text-sm font-bold text-red-500 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:-translate-y-0.5 hover:shadow-md hover:text-red-600 transition-all">
          <i className="fa-solid fa-arrow-right-from-bracket"></i> Logout
        </button>
      </div>

      {/* Hero */}
      <div className="w-full max-w-4xl px-6 py-8">
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-green-200">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Live ordering
        </div>
        <h1 className="text-3xl md:text-4xl font-bold font-heading text-[#2b1b10] mb-3">
          Hey, <span className="text-brand">{data?.username}</span>! 👋
        </h1>
        <p className="text-gray-500 max-w-md leading-relaxed">
          Craving something delicious? Browse top outlets and get your favourite meals delivered fresh.
        </p>
      </div>

      {/* Outlets Section */}
      <div className="w-full max-w-4xl px-6 pb-12">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">
          <i className="fa-solid fa-store-slash opacity-50"></i>
          Available Outlets
        </div>

        {data?.outlets && data.outlets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.outlets.map((outlet) => (
              <Link 
                href={`/outlet/${outlet.id}`} 
                key={outlet.id}
                onMouseEnter={() => prefetchAPI(`${process.env.NEXT_PUBLIC_API_URL}/app/outlet/${outlet.id}/`)}
                className="group bg-white rounded-3xl p-4 flex items-center gap-5 border border-gray-100 shadow-[0_2px_15px_rgba(0,0,0,0.03)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100">
                  {outlet.logo_url ? (
                    <Image 
                      src={getImageUrl(outlet.logo_url) as string} 
                      alt={outlet.name}
                      fill
                      sizes="96px"
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                      unoptimized={outlet.logo_url.includes('res.cloudinary.com')}
                    />
                  ) : (
                    <i className="fa-solid fa-store text-3xl text-gray-300 group-hover:scale-110 transition-transform duration-500"></i>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-green-500 text-white text-[10px] font-bold text-center py-0.5 uppercase tracking-wider">
                    Open
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col py-1">
                  <h3 className="text-lg font-bold font-heading text-[#2b1b10] mb-1 line-clamp-1 group-hover:text-brand transition-colors">
                    {outlet.name}
                  </h3>
                  <div className="text-sm font-medium text-gray-400 flex items-center gap-1.5 mb-3">
                    <i className="fa-regular fa-clock"></i> 15–25 min
                  </div>
                  <div className="text-sm font-bold text-brand flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                    View menu <i className="fa-solid fa-arrow-right text-[10px]"></i>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 p-12 flex flex-col items-center justify-center text-center shadow-[0_2px_15px_rgba(0,0,0,0.03)]">
            <div className="w-16 h-16 bg-orange-50 text-brand rounded-full flex items-center justify-center text-2xl mb-4">
              <i className="fa-solid fa-shop-slash"></i>
            </div>
            <h3 className="text-lg font-bold font-heading text-[#2b1b10] mb-2">No outlets available</h3>
            <p className="text-gray-500 text-sm">Check back soon for new delicious options!</p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
