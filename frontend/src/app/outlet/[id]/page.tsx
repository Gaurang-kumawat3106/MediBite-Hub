"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { fetchWithCache, invalidateCache } from "@/lib/apiCache";
import { fetchWithCSRF } from "@/lib/csrf";
import { getImageUrl, getApiUrl } from "@/lib/utils";
import { useWebSocket } from "@/hooks/useWebSocket";

const Footer = dynamic(() => import("@/components/Footer"), { ssr: false });

interface Product {
  id: number;
  name: string;
  customer_price: number;
  is_available?: boolean;
  image_url: string | null;
  is_veg?: boolean;
}

interface Category {
  id: number;
  name: string;
  products: Product[];
}

interface OutletData {
  success: boolean;
  msg?: string;
  outlet: {
    id: number;
    name: string;
    description: string;
    logo_url: string | null;
    is_accepting_orders?: boolean;
  };
  categories: Category[];
  cart_count: number;
}

const isNonVegItem = (name: string, isVegProp?: boolean) => {
  if (isVegProp === false) return true;
  if (isVegProp === true) return false;
  
  const lower = name.toLowerCase();
  if (lower.includes('paneer') || lower.includes('veg') || lower.includes('hara bhara') || lower.includes('corn') || lower.includes('gobi') || lower.includes('dal') || lower.includes('naan') || lower.includes('roti') || lower.includes('sweet') || lower.includes('gulab') || lower.includes('rasgulla')) {
    return false;
  }
  const nonVegKeywords = ['chicken', 'mutton', 'meat', 'egg', 'fish', 'prawn', 'seafood', 'beef', 'pork', 'keema', 'wings', 'seekh', 'bacon', 'ham', 'lamb', '65', 'kebab'];
  return nonVegKeywords.some(kw => lower.includes(kw));
};

export default function OutletDetailPage() {
  const router = useRouter();
  const params = useParams();
  const outletId = params?.id as string;
  
  const [data, setData] = useState<OutletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Cart toast state
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'} | null>(null);
  const [addingId, setAddingId] = useState<number | null>(null);

  const fetchOutletData = async (force = false) => {
    try {
      const json = await fetchWithCache<OutletData>(`${getApiUrl()}/app/outlet/${outletId}/`, force);
      if (json.success) {
        setData(json);
      } else {
        setError(json.msg || "Failed to load outlet menu.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (outletId) {
      fetchOutletData();
    }
  }, [outletId]);

  useWebSocket("/ws/orders/", (wsData) => {
    if (wsData.type === 'product_deactivated' || wsData.type === 'outlet_status_update') {
      fetchOutletData(true);
    }
  });

  // Grouped Categories with Matching Products
  const groupedCategories = useMemo(() => {
    if (!data?.categories) return [];
    
    return data.categories.map(cat => {
      const matchingProducts = cat.products.filter(p => 
        searchQuery === "" || p.name.toLowerCase().includes(searchQuery.toLowerCase())
      ).map(p => ({ ...p, categoryName: cat.name }));

      return {
        ...cat,
        products: matchingProducts
      };
    }).filter(cat => 
      (activeCategory === "all" || activeCategory === cat.name.toLowerCase()) && cat.products.length > 0
    );
  }, [data, activeCategory, searchQuery]);

  const handleAddToCart = async (e: React.MouseEvent, productId: number, productName: string) => {
    e.preventDefault();
    if (data?.outlet?.is_accepting_orders === false) {
      setToast({ msg: `${data.outlet.name} is currently not accepting orders.`, type: 'error' });
      return;
    }
    if (addingId === productId) return;

    // Instant optimistic visual feedback (0ms perceived latency!)
    setAddingId(productId);
    setToast({ msg: `${productName} added to cart!`, type: 'success' });
    setTimeout(() => setAddingId(null), 400);

    try {
      const res = await fetchWithCSRF(`${getApiUrl()}/app/add-to-cart/${productId}/`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
        },
        credentials: "include"
      });

      if (res.status === 401) {
        setToast({ msg: "Please log in to add items to cart", type: 'error' });
        setTimeout(() => { router.replace("/login"); }, 1200);
        return;
      }

      const contentType = res.headers.get("content-type");
      if (!res.ok || !contentType || !contentType.includes("application/json")) {
        setToast({ msg: `Could not add item (${res.status}).`, type: 'error' });
        return;
      }
      const resData = await res.json();
      if (!resData.success) {
        setToast({ msg: resData.message || "Could not add item.", type: 'error' });
      } else {
        invalidateCache(`${getApiUrl()}/app/cart/`);
        // Update local cart count optimistic update
        setData(prev => prev ? { ...prev, cart_count: (prev.cart_count || 0) + 1 } : null);
      }
    } catch (err) {
      setToast({ msg: "Something went wrong.", type: 'error' });
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#f6f3ed] flex flex-col items-center">
        {/* Header Skeleton */}
        <div className="w-full bg-[#13382c] rounded-b-[2.5rem] px-6 pt-6 pb-12 flex flex-col items-center">
          <div className="w-full max-w-5xl flex items-center justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse"></div>
            <div className="w-36 h-6 rounded-lg bg-white/10 animate-pulse"></div>
            <div className="w-24 h-10 rounded-full bg-white/10 animate-pulse"></div>
          </div>
          <div className="w-full max-w-5xl space-y-3">
            <div className="w-64 h-10 rounded-2xl bg-white/10 animate-pulse"></div>
            <div className="w-48 h-5 rounded bg-white/10 animate-pulse"></div>
          </div>
        </div>

        {/* Product Cards Grid Skeleton */}
        <div className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-white rounded-3xl p-4 border border-gray-100 flex flex-col items-center shadow-sm">
                <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-gray-100 animate-pulse mb-4"></div>
                <div className="w-24 h-4 rounded bg-gray-100 animate-pulse mb-2"></div>
                <div className="w-16 h-3 rounded bg-gray-100 animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.outlet) {
    return (
      <div className="min-h-screen bg-[#f6f3ed] flex flex-col items-center justify-center p-6 text-center">
        <i className="fa-solid fa-store-slash text-5xl text-[#13382c]/40 mb-4"></i>
        <h2 className="text-2xl font-bold font-serif text-[#13382c] mb-2">Outlet Unavailable</h2>
        <p className="text-gray-500 mb-6 max-w-md">{error}</p>
        <Link href="/customer/home" className="bg-[#13382c] text-white px-6 py-2.5 rounded-full font-bold shadow-lg hover:bg-[#1a4a3b] transition-all">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f3ed] text-[#13382c] flex flex-col relative pb-28">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border backdrop-blur-md ${
            toast.type === 'success' 
              ? 'bg-[#13382c] text-white border-emerald-400/30' 
              : 'bg-red-950 text-red-100 border-red-500/30'
          }`}>
            <i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check text-[#e8a135]' : 'fa-circle-exclamation text-red-400'}`}></i>
            <span className="text-xs sm:text-sm font-semibold">{toast.msg}</span>
            {toast.type === 'success' && (
              <Link href="/cart" className="ml-2 text-xs uppercase tracking-wider font-extrabold text-[#e8a135] underline">View Cart</Link>
            )}
          </div>
        </div>
      )}

      {/* Forest Green Header Section (Matching Home Page) */}
      <div className="bg-[#13382c] text-white rounded-b-[2.5rem] sm:rounded-b-[3.2rem] shadow-md transition-all">
        
        {/* Navigation Bar */}
        <nav className="sticky top-0 z-40 bg-[#13382c]/95 backdrop-blur-md px-4 sm:px-6 py-4 flex items-center justify-between border-b border-white/10">
          {/* Left: Back Button & Outlet Title */}
          <div className="flex items-center gap-3 min-w-0">
            <Link 
              href="/customer/home" 
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all shrink-0 active:scale-95 border border-white/15"
              title="Back to Outlets"
            >
              <i className="fa-solid fa-chevron-left text-xs sm:text-sm"></i>
            </Link>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] sm:text-xs text-[#a8c9bd] font-sans tracking-wide uppercase font-semibold leading-tight">
                Ordering from
              </span>
              <h2 className="text-sm sm:text-base md:text-lg font-bold font-serif text-white truncate leading-tight">
                {data.outlet.name}
              </h2>
            </div>
          </div>

          {/* Right Action Controls: Search & Cart Button (Replaces Veg Toggle) */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button 
              onClick={() => {
                setIsSearchOpen(true);
                setTimeout(() => document.getElementById('searchInput')?.focus(), 100);
              }} 
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors border border-white/15"
              title="Search Menu"
            >
              <i className="fa-solid fa-magnifying-glass text-xs sm:text-sm"></i>
            </button>

            <Link 
              href="/cart" 
              className="flex items-center gap-2 bg-[#e8a135] hover:bg-[#d48e28] text-[#13382c] px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95"
            >
              <i className="fa-solid fa-cart-shopping text-[#13382c]"></i>
              <span>Cart</span>
              {data.cart_count > 0 && (
                <span className="bg-[#13382c] text-white text-[10px] font-extrabold rounded-full px-1.5 py-0.2 min-w-4 text-center">
                  {data.cart_count}
                </span>
              )}
            </Link>
          </div>
        </nav>

        {/* Craving Headline Section */}
        <div className="px-6 pt-6 pb-10 max-w-5xl mx-auto w-full">
          <div className="flex flex-col items-start">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-white font-bold leading-tight">
              What are you craving today?
            </h1>
            <p className="text-[#bce0d4] text-sm md:text-base font-sans mt-2">
              Made fresh when you order.
            </p>
          </div>
        </div>
      </div>

      {/* Search Modal Overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-[#13382c]/95 backdrop-blur-md flex flex-col p-6 animate-in fade-in duration-200">
          <div className="flex items-center gap-4 relative max-w-2xl mx-auto w-full mt-4">
            <i className="fa-solid fa-magnifying-glass absolute left-4 text-[#e8a135]"></i>
            <input 
              id="searchInput"
              type="text" 
              placeholder="Search items, starters, drinks..."
              className="w-full bg-white/10 border border-white/20 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-[#e8a135] focus:ring-4 focus:ring-[#e8a135]/20 transition-all font-medium text-white placeholder:text-gray-300"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button 
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery("");
              }}
              className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-colors shrink-0"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      )}

      {/* Closed Outlet Banner */}
      {data.outlet.is_accepting_orders === false && (
        <div className="bg-amber-500/15 text-amber-900 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm text-center max-w-5xl mx-auto w-full mt-4 rounded-2xl">
          <i className="fa-solid fa-triangle-exclamation text-amber-600"></i>
          <span>This outlet is currently <strong>not accepting orders</strong>. Menu is in preview mode.</span>
        </div>
      )}

      {/* Main Content Area - Category Sections & Product Grid */}
      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        {groupedCategories.length > 0 ? (
          <div className="space-y-12">
            {groupedCategories.map((category) => (
              <div key={category.id} className="space-y-5">
                {/* Category Header with Divider Line */}
                <div className="flex items-center gap-4">
                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#13382c] tracking-tight">
                    {category.name}
                  </h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-[#13382c]/20 to-transparent"></div>
                </div>

                {/* Product Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {category.products.map((product, index) => {
                    const isNonVeg = isNonVegItem(product.name, product.is_veg);
                    return (
                      <div 
                        key={product.id} 
                        className="bg-white rounded-3xl p-4 border border-gray-100 flex flex-col justify-between relative group hover:shadow-[0_12px_30px_rgba(19,56,44,0.08)] hover:-translate-y-1 transition-all duration-300 shadow-sm"
                      >
                        {/* Veg / Non-Veg Indicator Badge */}
                        <div className="absolute top-4 left-4 z-10">
                          {isNonVeg ? (
                            <div className="w-4 h-4 border border-red-500 rounded-sm flex items-center justify-center bg-red-50" title="Non-Vegetarian">
                              <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            </div>
                          ) : (
                            <div className="w-4 h-4 border border-emerald-600 rounded-sm flex items-center justify-center bg-emerald-50" title="Vegetarian">
                              <div className="w-2 h-2 rounded-full bg-emerald-600"></div>
                            </div>
                          )}
                        </div>

                        {/* Circular Dish Image Container */}
                        <div className="relative w-28 h-28 sm:w-32 sm:h-32 mx-auto mt-2 mb-3 rounded-full p-1 bg-gradient-to-b from-[#e8a135]/30 via-[#13382c]/10 to-[#e8a135]/30 border-2 border-[#e8a135]/40 shadow-[0_4px_16px_rgba(232,161,53,0.2)] flex items-center justify-center group-hover:scale-105 group-hover:shadow-[0_6px_22px_rgba(232,161,53,0.3)] transition-all duration-300">
                          <div className="w-full h-full rounded-full overflow-hidden bg-[#f4f2eb] flex items-center justify-center">
                            {product.image_url ? (
                              <img 
                                src={getImageUrl(product.image_url, 320) as string} 
                                alt={product.name} 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                loading={index < 4 ? "eager" : "lazy"}
                                decoding="async"
                                fetchPriority={index < 2 ? "high" : "auto"}
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                  const fallback = (e.target as HTMLElement).nextElementSibling;
                                  if (fallback) fallback.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={`w-full h-full flex items-center justify-center text-[#13382c]/30 text-3xl ${product.image_url ? 'hidden' : ''}`}>
                              <i className="fa-solid fa-bowl-food"></i>
                            </div>
                          </div>
                        </div>

                        {/* Text Information & Price */}
                        <div className="text-center flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="text-sm sm:text-base font-bold font-serif text-[#13382c] leading-snug line-clamp-2">
                              {product.name}
                            </h3>
                            <p className="text-[11px] text-gray-400 font-sans mt-1 line-clamp-1">
                              {category.name}
                            </p>
                          </div>

                          {/* Price & Add to Cart Button */}
                          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                            <div className="font-bold text-[#13382c] text-base sm:text-lg font-sans">
                              ₹{product.customer_price}
                            </div>

                            {data.outlet.is_accepting_orders === false ? (
                              <span className="bg-gray-100 text-gray-400 font-bold px-2.5 py-1 rounded-full text-[10px]">
                                Closed
                              </span>
                            ) : product.is_available === false ? (
                              <span className="bg-red-50 text-red-500 font-bold px-2 py-1 rounded-full text-[10px] border border-red-100">
                                Out of Stock
                              </span>
                            ) : (
                              <button 
                                onClick={(e) => handleAddToCart(e, product.id, product.name)}
                                disabled={addingId === product.id}
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#13382c] hover:bg-[#1a4a3b] text-white font-bold text-base shadow-md flex items-center justify-center active:scale-95 transition-all disabled:opacity-60"
                                title={`Add ${product.name} to cart`}
                              >
                                {addingId === product.id ? (
                                  <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                                ) : (
                                  <i className="fa-solid fa-plus text-sm"></i>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-20 px-6">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-gray-400 text-3xl mb-4 border border-gray-200/60 shadow-sm">
              <i className="fa-solid fa-magnifying-glass"></i>
            </div>
            <h3 className="text-xl font-bold font-serif text-[#13382c] mb-2">No items found</h3>
            <p className="text-gray-500 text-sm">Try a different search query or select another category.</p>
          </div>
        )}
      </main>

      {/* Floating Bottom Category Navigation Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#13382c] text-white px-3 py-2 rounded-full shadow-2xl border border-white/10 flex items-center gap-1.5 max-w-[92vw] overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveCategory("all")}
          className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all ${
            activeCategory === "all" 
              ? "bg-[#e8a135] text-[#13382c] shadow-md scale-105" 
              : "text-[#a8c9bd] hover:text-white hover:bg-white/10"
          }`}
        >
          All
        </button>
        {data.categories?.map(cat => (
          <button 
            key={cat.id}
            onClick={() => setActiveCategory(cat.name.toLowerCase())}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all ${
              activeCategory === cat.name.toLowerCase() 
                ? "bg-[#e8a135] text-[#13382c] shadow-md scale-105" 
                : "text-[#a8c9bd] hover:text-white hover:bg-white/10"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <Footer />
    </div>
  );
}
