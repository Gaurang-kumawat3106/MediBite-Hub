"use client";

import { useEffect, useState } from "react";
import OutletSidebar from "@/components/OutletSidebar";
import { fetchWithCache, invalidateCache } from "@/lib/apiCache";
import { fetchWithCSRF } from "@/lib/csrf";
import toast, { Toaster } from "react-hot-toast";

const getImageUrl = (url: string | null) => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${process.env.NEXT_PUBLIC_API_URL}${url}`;
};

export default function OutletProducts() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formImage, setFormImage] = useState<File | null>(null);

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

  
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("name", formName);
      formData.append("price", formPrice);
      formData.append("category", formCategory);
      if (formImage) formData.append("image", formImage);
      await fetchWithCSRF(`${process.env.NEXT_PUBLIC_API_URL}/app/outlet/add-product/`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      setIsAddingProduct(false);
      fetchProducts();
      toast.success(`Product Added Successfully
Product: ${formName}`);
    } catch (err: any) { console.error(err); toast.error("Failed to add product"); }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new URLSearchParams();
      formData.append("name", formName);
      await fetchWithCSRF(`${process.env.NEXT_PUBLIC_API_URL}/app/outlet/add-category/`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        credentials: "include"
      });
      setIsAddingCategory(false);
      fetchProducts();
      toast.success(`Category Added Successfully
Category: ${formName}`);
    } catch (err: any) { console.error(err); toast.error("Failed to add category"); }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("name", formName);
      formData.append("price", formPrice);
      formData.append("category", formCategory);
      if (formImage) formData.append("image", formImage);
      await fetchWithCSRF(`${process.env.NEXT_PUBLIC_API_URL}/app/outlet/product/${editingProduct.id}/edit/`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      setEditingProduct(null);
      fetchProducts();
      toast.success(`Product Updated Successfully`);
    } catch (err: any) { console.error(err); toast.error("Failed to update product"); }
  };

  const toggleAvailability = async (productId: number) => {
    try {
      await fetchWithCSRF(`${process.env.NEXT_PUBLIC_API_URL}/app/outlet/product/${productId}/toggle/`, {
        method: "POST",
        headers: { "Accept": "application/json" },
        credentials: "include"
      });
      invalidateCache(`${process.env.NEXT_PUBLIC_API_URL}/app/outlet/products/`);
      fetchProducts();
      toast.success("Availability changed");
    } catch (e: any) { toast.error("Failed to change availability");
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
      <Toaster position="bottom-right" />
      <OutletSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold font-heading text-[#2b1b10]">Menu Management</h1>
            <div className="flex gap-4"><button onClick={() => {setFormName(""); setFormPrice(""); setFormCategory(""); setIsAddingProduct(true);}} className="bg-brand text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-brand/20 hover:bg-brand-dark transition-colors">+ Add Product</button><button onClick={() => {setFormName(""); setIsAddingCategory(true);}} className="bg-gray-100 text-[#2b1b10] px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-gray-200 transition-colors">+ Add Category</button></div>
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
                          <button onClick={() => {setEditingProduct(prod); setFormName(prod.name); setFormPrice(prod.price); setFormCategory(cat.id.toString());}} className="text-gray-400 hover:text-brand transition-colors p-2">
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

      {/* Modal Overlays */}
      {(isAddingProduct || editingProduct) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6 text-[#2b1b10]">{editingProduct ? "Edit Product" : "Add Product"}</h2>
            <form onSubmit={editingProduct ? handleEditProduct : handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Name</label>
                <input required type="text" className="w-full border border-gray-200 rounded-xl px-4 py-2" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Price</label>
                <input required type="number" step="0.01" className="w-full border border-gray-200 rounded-xl px-4 py-2" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Category</label>
                <select required className="w-full border border-gray-200 rounded-xl px-4 py-2" value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                  <option value="">Select Category</option>
                  {data?.categories?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Image</label>
                <input type="file" accept="image/*" className="w-full" onChange={(e) => setFormImage(e.target.files?.[0] || null)} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => {setIsAddingProduct(false); setEditingProduct(null);}} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 bg-brand text-white font-bold py-3 rounded-xl">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddingCategory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6 text-[#2b1b10]">Add Category</h2>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Category Name</label>
                <input required type="text" className="w-full border border-gray-200 rounded-xl px-4 py-2" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsAddingCategory(false)} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 bg-brand text-white font-bold py-3 rounded-xl">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}