"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { fetchWithCache } from "@/lib/apiCache";
import { fetchWithCSRF } from "@/lib/csrf";

const Footer = dynamic(() => import("@/components/Footer"), { ssr: false });

const getOptimizedImageUrl = (url: string | null, width = 500) => {
  if (!url) return null;
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    // Prevent double injection if already optimized
    if (!url.includes('/q_auto')) {
      return url.replace('/upload/', `/upload/q_auto,f_auto,w_${width},c_limit/`);
    }
  }
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${process.env.NEXT_PUBLIC_API_URL}${url}`;
};

interface Product {
  id: number;
  name: string;
  customer_price: number;
  image_url: string | null;
}

interface Category {
  id: number;
  name: string;
  products: Product[];
}

interface OutletData {
  success: boolean;
  outlet?: {
    id: number;
    name: string;
    logo_url: string | null;
  };
  categories?: Category[];
  msg?: string;
}

export default function OutletDetailPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [data, setData] = useState<OutletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Cart toast state
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'} | null>(null);
  const fetchRef = useRef(false);

  useEffect(() => {
    if (fetchRef.current) return;
    fetchRef.current = true;

    async function fetchData() {
      try {
        const json = await fetchWithCache<OutletData>(`${process.env.NEXT_PUBLIC_API_URL}/app/outlet/${id}/`);
        if (json.success) {
          setData(json);
        } else {
          setError(json.msg || "Failed to load outlet details.");
        }
      } catch (err) {
        console.error(err);
        setError("Network error. Please make sure the Django server is running.");
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchData();
  }, [id]);

  // Derived filtered products
  const filteredProducts = useMemo(() => {
    if (!data?.categories) return [];
    
    let allProducts: (Product & { categoryName: string })[] = [];
    
    data.categories.forEach(cat => {
      if (activeCategory === "all" || activeCategory === cat.name.toLowerCase()) {
        const matchingProducts = cat.products.filter(p => 
          searchQuery === "" || p.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        allProducts = [...allProducts, ...matchingProducts.map(p => ({ ...p, categoryName: cat.name }))];
      }
    });
    
    return allProducts;
  }, [data, activeCategory, searchQuery]);

  const handleAddToCart = async (e: React.MouseEvent, productId: number, productName: string) => {
    e.preventDefault();
    const btn = e.currentTarget as HTMLButtonElement;
    
    if (btn.disabled) return;
    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
      const res = await fetchWithCSRF(`${process.env.NEXT_PUBLIC_API_URL}/app/add-to-cart/${productId}/`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          // Django cart API needs a CSRF token or we need to bypass it via @csrf_exempt
          // Assuming we use standard fetch or it's exempted
        },
        credentials: "include"
      });
      const resData = await res.json();
      if (resData.success) {
        setToast({ msg: `${productName} added to cart!`, type: 'success' });
      } else {
        setToast({ msg: resData.message || "Could not add item.", type: 'error' });
      }
    } catch (err) {
      setToast({ msg: "Something went wrong.", type: 'error' });
    } finally {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
      setTimeout(() => setToast(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f6] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand/20 border-t-brand rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !data?.outlet) {
    return (
      <div className="min-h-screen bg-[#faf9f6] flex flex-col items-center justify-center p-6 text-center">
        <i className="fa-solid fa-store-slash text-4xl text-gray-300 mb-4"></i>
        <h2 className="text-xl font-bold text-[#2b1b10] mb-2">Outlet Unavailable</h2>
        <p className="text-gray-500 mb-6">{error}</p>
        <Link href="/customer/home" className="bg-brand text-white px-6 py-2 rounded-xl font-semibold hover:bg-brand-dark transition-colors">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col relative">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-lg border ${
            toast.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            <i className={`fa-solid ${toast.type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'}`}></i>
            <span className="text-sm font-semibold">{toast.msg}</span>
            {toast.type === 'success' && (
              <Link href="/cart" className="ml-2 text-xs uppercase tracking-wider font-bold underline">View Cart</Link>
            )}
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-6 py-4">
        <Link href="/customer/home" className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors">
          <i className="fa-solid fa-arrow-left"></i>
        </Link>
        <div className="text-lg font-bold font-heading text-[#2b1b10]">{data.outlet.name}</div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setIsSearchOpen(true);
              setTimeout(() => document.getElementById('searchInput')?.focus(), 100);
            }} 
            className="w-10 h-10 rounded-full bg-orange-50 text-brand flex items-center justify-center hover:bg-orange-100 transition-colors"
          >
            <i className="fa-solid fa-magnifying-glass"></i>
          </button>
          <Link href="/cart" className="flex items-center gap-2 bg-[#2b1b10] text-white px-4 py-2.5 rounded-full text-sm font-bold hover:bg-black transition-colors">
            <i className="fa-solid fa-cart-shopping"></i> <span className="hidden sm:inline">Cart</span>
          </Link>
        </div>
      </nav>

      {/* Search Overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col p-6 animate-in fade-in duration-200">
          <div className="flex items-center gap-4 relative">
            <i className="fa-solid fa-magnifying-glass absolute left-4 text-gray-400"></i>
            <input 
              id="searchInput"
              type="text" 
              placeholder="Search items, meals, drinks..."
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all font-medium text-[#2b1b10]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button 
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery("");
              }}
              className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors shrink-0"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="bg-[#2b1b10] text-white px-6 py-10 flex flex-col items-center text-center">
          <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl overflow-hidden bg-white shrink-0 border-[3px] border-white shadow-md z-10 flex items-center justify-center">
            {data.outlet.logo_url ? (
              <img 
                src={getOptimizedImageUrl(data.outlet.logo_url, 400) as string} 
                alt={data.outlet.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <i className="fa-solid fa-store text-3xl text-gray-300"></i>
            )}
          </div>
        <h1 className="text-3xl font-bold font-heading mb-2">{data.outlet.name}</h1>
        <p className="text-gray-400 text-sm max-w-sm">Order your favourite meals, freshly prepared.</p>
      </div>

      {/* Category Strip */}
      <div className="sticky top-[73px] z-30 bg-[#faf9f6]/95 backdrop-blur-sm py-4 border-b border-gray-100">
        <div className="flex items-center gap-3 overflow-x-auto px-6 no-scrollbar pb-1">
          <button 
            onClick={() => setActiveCategory("all")}
            className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
              activeCategory === "all" ? "bg-[#2b1b10] text-white shadow-md" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            All
          </button>
          {data.categories?.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setActiveCategory(cat.name.toLowerCase())}
              className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                activeCategory === cat.name.toLowerCase() ? "bg-[#2b1b10] text-white shadow-md" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {filteredProducts.map((product, index) => (
              <div key={product.id} className="bg-white rounded-3xl border border-gray-100 overflow-hidden flex flex-col shadow-[0_2px_15px_rgba(0,0,0,0.03)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                <div className="relative aspect-square bg-gray-50 border-b border-gray-100">
                  {product.image_url ? (
                    <img 
                      src={getOptimizedImageUrl(product.image_url, 400) as string} 
                      alt={product.name} 
                      className="w-full h-full object-cover"
                      loading={index < 6 ? "eager" : "lazy"}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">
                      <i className="fa-solid fa-bowl-food"></i>
                    </div>
                  )}
                  
                  {/* Add Button */}
                  <button 
                    onClick={(e) => handleAddToCart(e, product.id, product.name)}
                    className="absolute -bottom-5 right-4 bg-white border border-gray-100 shadow-md rounded-full flex items-center overflow-hidden group/btn hover:border-brand transition-colors"
                  >
                    <div className="px-3 py-2 text-sm font-bold text-[#2b1b10]">
                      ₹{product.customer_price}
                    </div>
                    <div className="w-10 h-10 flex items-center justify-center bg-gray-50 text-brand border-l border-gray-100 group-hover/btn:bg-brand group-hover/btn:text-white transition-colors">
                      <i className="fa-solid fa-plus"></i>
                    </div>
                  </button>
                </div>
                
                <div className="p-4 pt-6 flex-1 flex flex-col">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    {product.categoryName}
                  </div>
                  <h3 className="text-sm md:text-base font-bold font-heading text-[#2b1b10] leading-tight line-clamp-2">
                    {product.name}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-20 px-6">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 text-3xl mb-4">
              <i className="fa-solid fa-magnifying-glass"></i>
            </div>
            <h3 className="text-xl font-bold font-heading text-[#2b1b10] mb-2">No items found</h3>
            <p className="text-gray-500 text-sm">Try a different search or change the category.</p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
