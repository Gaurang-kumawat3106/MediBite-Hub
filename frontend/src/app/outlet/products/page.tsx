"use client";

import { useEffect, useState } from "react";
import OutletSidebar from "@/components/OutletSidebar";
import { fetchWithCache, invalidateCache } from "@/lib/apiCache";
import { fetchWithCSRF } from "@/lib/csrf";

const getImageUrl = (url: string | null) => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${process.env.NEXT_PUBLIC_API_URL}${url}`;
};

export default function OutletProducts() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const json = await fetchWithCache<any>(`${process.env.NEXT_PUBLIC_API_URL}/app/outlet/products/`);
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
    invalidateCache(`${process.env.NEXT_PUBLIC_API_URL}/app/outlet/products/`);
      fetchProducts();
  }, []);

  const toggleAvailability = async (productId: number) => {
    try {
      await fetchWithCSRF(`${process.env.NEXT_PUBLIC_API_URL}/app/outlet/product/${productId}/toggle/`, {
        method: "POST",
        headers: { "Accept": "application/json" },
        credentials: "include"
      });
      invalidateCache(`${process.env.NEXT_PUBLIC_API_URL}/app/outlet/products/`);
      fetchProducts();
    } catch (e) {
      console.error(e);
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
            <h1 className="text-2xl font-bold font-heading text-[#2b1b10]">Menu Management</h1>
            <button className="bg-brand text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-brand/20 hover:bg-brand-dark transition-colors">
              + Add Product
            </button>
          </div>

          <div className="space-y-8">
            {data?.categories?.length > 0 ? data.categories.map((cat: any) => (
              <div key={cat.id} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <h2 className="text-xl font-bold font-heading text-[#2b1b10] mb-4 border-b border-gray-100 pb-2">{cat.name}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cat.products.map((prod: any) => (
                    <div key={prod.id} className="flex gap-4 border border-gray-100 rounded-2xl p-3 items-center group hover:border-gray-300 transition-colors">
                      <div className="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden shrink-0">
                        {prod.image_url ? (
                          <img src={getImageUrl(prod.image_url) as string} alt={prod.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300"><i className="fa-solid fa-bowl-food"></i></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-[#2b1b10] line-clamp-1">{prod.name}</h3>
                          {prod.type === "veg" && <div className="w-3 h-3 rounded-full bg-green-500 border border-white outline outline-1 outline-green-500"></div>}
                          {prod.type === "non_veg" && <div className="w-3 h-3 rounded-full bg-red-500 border border-white outline outline-1 outline-red-500"></div>}
                        </div>
                        <div className="font-bold text-brand mb-2">₹{prod.price}</div>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <div className={`w-10 h-5 rounded-full relative transition-colors ${prod.is_available ? "bg-green-500" : "bg-gray-300"}`}>
                              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${prod.is_available ? "left-[22px]" : "left-0.5"}`}></div>
                            </div>
                            <input 
                              type="checkbox" 
                              className="hidden" 
                              checked={prod.is_available} 
                              onChange={() => toggleAvailability(prod.id)} 
                            />
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                              {prod.is_available ? "In Stock" : "Sold Out"}
                            </span>
                          </label>
                          <button className="text-gray-400 hover:text-brand transition-colors p-2">
                            <i className="fa-solid fa-pen-to-square"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )) : (
              <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
                <i className="fa-solid fa-box-open text-4xl text-gray-300 mb-4"></i>
                <h3 className="text-lg font-bold text-gray-500">No products available</h3>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}