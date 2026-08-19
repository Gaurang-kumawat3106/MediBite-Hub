"use client";

import { useEffect, useState } from "react";
import OutletSidebar from "@/components/OutletSidebar";
import { fetchWithCache, invalidateCache } from "@/lib/apiCache";
import { fetchWithCSRF } from "@/lib/csrf";
import { getImageUrl, getApiUrl } from "@/lib/utils";
import toast, { Toaster } from "react-hot-toast";

interface Product {
  id: number;
  name: string;
  price: number;
  customer_price?: number;
  is_available: boolean;
  image_url?: string | null;
  type?: string;
}

interface Category {
  id: number;
  name: string;
  products: Product[];
}

interface OutletProductsData {
  success: boolean;
  categories: Category[];
}

export default function OutletProducts() {
  const [data, setData] = useState<OutletProductsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Category form state
  const [categoryName, setCategoryName] = useState("");
  const [submittingCategory, setSubmittingCategory] = useState(false);

  // Product form state
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productCategoryId, setProductCategoryId] = useState("");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [submittingProduct, setSubmittingProduct] = useState(false);

  const fetchProducts = async (force = false) => {
    try {
      if (force) {
        invalidateCache(`${getApiUrl()}/app/outlet/products/`);
      }
      const json = await fetchWithCache<OutletProductsData>(`${getApiUrl()}/app/outlet/products/`, force);
      if (json && json.success) {
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(true);
  }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = categoryName.trim();
    if (!trimmed) {
      toast.error("Category name cannot be empty");
      return;
    }

    setSubmittingCategory(true);
    try {
      const res = await fetchWithCSRF(`${getApiUrl()}/app/outlet/add-category/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        },
        body: new URLSearchParams({ name: trimmed }).toString(),
        credentials: "include"
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        toast.error(resData.error || "Failed to add category");
        setSubmittingCategory(false);
        return;
      }

      // Optimistically update local categories list
      const newCat: Category = resData.category || {
        id: Date.now(),
        name: trimmed,
        products: []
      };

      setData((prev) => {
        if (!prev) return { success: true, categories: [newCat] };
        const exists = prev.categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());
        if (exists) return prev;
        return { ...prev, categories: [...prev.categories, newCat] };
      });

      // Automatically preselect newly created category for add product modal
      setProductCategoryId(newCat.id.toString());
      setCategoryName("");
      setIsAddingCategory(false);
      invalidateCache(`${getApiUrl()}/app/outlet/products/`);
      toast.success(`Category "${trimmed}" added!`);
      // Sync fresh server state
      fetchProducts(true);
    } catch (err: any) {
      console.error(err);
      toast.error("Network error while adding category.");
    } finally {
      setSubmittingCategory(false);
    }
  };

  const handleDeleteCategory = async (categoryId: number, catName: string) => {
    if (!window.confirm(`Are you sure you want to delete category "${catName}" and all products inside it?`)) {
      return;
    }

    // Optimistic UI update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: prev.categories.filter((c) => c.id !== categoryId)
      };
    });

    try {
      const res = await fetchWithCSRF(`${getApiUrl()}/app/outlet/category/${categoryId}/delete/`, {
        method: "POST",
        headers: { "Accept": "application/json" },
        credentials: "include"
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        toast.success(`Category "${catName}" deleted.`);
        invalidateCache(`${getApiUrl()}/app/outlet/products/`);
      } else {
        toast.error(resData.error || "Failed to delete category.");
        fetchProducts(true);
      }
    } catch (e) {
      toast.error("Network error while deleting category.");
      fetchProducts(true);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      toast.error("Product name is required.");
      return;
    }
    if (!productPrice || parseFloat(productPrice) <= 0) {
      toast.error("Please enter a valid product price.");
      return;
    }
    if (!productCategoryId) {
      toast.error("Please select a category.");
      return;
    }

    setSubmittingProduct(true);
    try {
      const formData = new FormData();
      formData.append("name", productName.trim());
      formData.append("price", productPrice);
      formData.append("category", productCategoryId);
      if (productImage) {
        formData.append("image", productImage);
      }

      const res = await fetchWithCSRF(`${getApiUrl()}/app/outlet/add-product/`, {
        method: "POST",
        headers: { "Accept": "application/json" },
        body: formData,
        credentials: "include"
      });

      let resData: any = {};
      try {
        resData = await res.json();
      } catch (jsonErr) {
        toast.error(`Server returned an invalid response (${res.status}). Please try again.`);
        setSubmittingProduct(false);
        return;
      }

      if (!res.ok || !resData.success) {
        toast.error(resData.error || "Failed to add product.");
        setSubmittingProduct(false);
        return;
      }

      // Optimistic update
      if (resData.product) {
        const p = resData.product;
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            categories: prev.categories.map((c) => {
              if (c.id === parseInt(productCategoryId)) {
                return { ...c, products: [...c.products, p] };
              }
              return c;
            })
          };
        });
      }

      setIsAddingProduct(false);
      setProductName("");
      setProductPrice("");
      setProductCategoryId("");
      setProductImage(null);
      invalidateCache(`${getApiUrl()}/app/outlet/products/`);
      toast.success(`Product "${productName.trim()}" added successfully!`);
      fetchProducts(true);
    } catch (err: any) {
      console.error(err);
      toast.error("Network error while adding product.");
    } finally {
      setSubmittingProduct(false);
    }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    setSubmittingProduct(true);
    try {
      const formData = new FormData();
      formData.append("name", productName.trim());
      formData.append("price", productPrice);
      formData.append("category", productCategoryId);
      if (productImage) formData.append("image", productImage);

      const res = await fetchWithCSRF(`${getApiUrl()}/app/outlet/product/${editingProduct.id}/edit/`, {
        method: "POST",
        headers: { "Accept": "application/json" },
        body: formData,
        credentials: "include"
      });

      let resData: any = {};
      try {
        resData = await res.json();
      } catch (jsonErr) {
        toast.error(`Server returned an invalid response (${res.status}). Please try again.`);
        setSubmittingProduct(false);
        return;
      }

      if (!res.ok || !resData.success) {
        toast.error(resData.error || "Failed to update product.");
        setSubmittingProduct(false);
        return;
      }

      setEditingProduct(null);
      setProductName("");
      setProductPrice("");
      setProductCategoryId("");
      setProductImage(null);
      invalidateCache(`${getApiUrl()}/app/outlet/products/`);
      toast.success("Product updated successfully!");
      fetchProducts(true);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to update product.");
    } finally {
      setSubmittingProduct(false);
    }
  };

  const handleDeleteProduct = async (productId: number, prodName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${prodName}"?`)) {
      return;
    }

    // Optimistic delete
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: prev.categories.map((c) => ({
          ...c,
          products: c.products.filter((p) => p.id !== productId)
        }))
      };
    });

    try {
      const res = await fetchWithCSRF(`${getApiUrl()}/app/outlet/product/${productId}/delete/`, {
        method: "POST",
        headers: { "Accept": "application/json" },
        credentials: "include"
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        toast.success(`"${prodName}" deleted.`);
        invalidateCache(`${getApiUrl()}/app/outlet/products/`);
      } else {
        toast.error(resData.error || "Failed to delete product.");
        fetchProducts(true);
      }
    } catch (e) {
      toast.error("Network error while deleting product.");
      fetchProducts(true);
    }
  };

  const toggleAvailability = async (productId: number) => {
    setData((prev: any) => {
      if (!prev?.categories) return prev;
      return {
        ...prev,
        categories: prev.categories.map((cat: any) => ({
          ...cat,
          products: cat.products.map((p: any) =>
            p.id === productId ? { ...p, is_available: !p.is_available } : p
          )
        }))
      };
    });

    try {
      await fetchWithCSRF(`${getApiUrl()}/app/outlet/product/${productId}/toggle/`, {
        method: "POST",
        headers: { Accept: "application/json" },
        credentials: "include"
      });
      invalidateCache(`${getApiUrl()}/app/outlet/products/`);
      toast.success("Availability updated");
    } catch (e: any) {
      toast.error("Failed to change availability");
      fetchProducts(true);
    }
  };

  const openAddProductModal = (presetCategoryId?: number) => {
    setProductName("");
    setProductPrice("");
    setProductCategoryId(presetCategoryId ? presetCategoryId.toString() : (data?.categories?.[0]?.id?.toString() || ""));
    setProductImage(null);
    setEditingProduct(null);
    setIsAddingProduct(true);
  };

  const openEditProductModal = (prod: Product, categoryId: number) => {
    setEditingProduct(prod);
    setProductName(prod.name);
    setProductPrice(prod.price.toString());
    setProductCategoryId(categoryId.toString());
    setProductImage(null);
    setIsAddingProduct(false);
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] flex">
      <Toaster position="bottom-right" />
      <OutletSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto">
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold font-heading text-[#2b1b10]">Menu & Catalog Management</h1>
              <p className="text-sm text-gray-500 mt-1">Organize categories, add items, and manage real-time availability.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setCategoryName("");
                  setIsAddingCategory(true);
                }}
                className="bg-white border border-gray-200 text-[#2b1b10] px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-folder-plus text-brand"></i> Add Category
              </button>
              <button
                onClick={() => openAddProductModal()}
                className="bg-brand text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-brand/20 hover:bg-brand-dark transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-plus"></i> Add Product
              </button>
            </div>
          </div>

          {/* Loading Skeleton */}
          {loading && !data ? (
            <div className="space-y-8">
              {[1, 2].map((catIdx) => (
                <div key={catIdx} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                  <div className="w-36 h-6 rounded-lg skeleton-shimmer mb-4 border-b border-gray-100 pb-2"></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((itemIdx) => (
                      <div key={itemIdx} className="flex gap-4 border border-gray-100 rounded-2xl p-3 items-center">
                        <div className="w-20 h-20 rounded-xl skeleton-shimmer shrink-0"></div>
                        <div className="flex-1 space-y-2">
                          <div className="w-3/4 h-5 rounded skeleton-shimmer"></div>
                          <div className="w-1/3 h-4 rounded skeleton-shimmer"></div>
                          <div className="w-1/2 h-4 rounded skeleton-shimmer"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {data?.categories && data.categories.length > 0 ? (
                data.categories.map((cat) => (
                  <div key={cat.id} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                    {/* Category Header */}
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold font-heading text-[#2b1b10]">{cat.name}</h2>
                        <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                          {cat.products?.length || 0} {cat.products?.length === 1 ? "item" : "items"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openAddProductModal(cat.id)}
                          className="text-xs font-bold text-brand hover:text-brand-dark bg-brand/10 hover:bg-brand/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                          title="Add Item to this Category"
                        >
                          <i className="fa-solid fa-plus text-[10px]"></i> Add Item
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"
                          title="Delete Category"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </div>

                    {/* Products Grid */}
                    {cat.products && cat.products.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cat.products.map((prod) => (
                          <div
                            key={prod.id}
                            className="flex gap-4 border border-gray-100 rounded-2xl p-3 items-center group hover:border-gray-300 transition-colors bg-white"
                          >
                            <div className="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden shrink-0 relative">
                              {prod.image_url ? (
                                <img
                                  src={getImageUrl(prod.image_url, 160) as string}
                                  alt={prod.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                  <i className="fa-solid fa-bowl-food text-2xl"></i>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-[#2b1b10] truncate text-base">{prod.name}</h3>
                                {prod.type === "veg" && (
                                  <div className="w-3 h-3 rounded-full bg-green-500 border border-white outline outline-1 outline-green-500 shrink-0"></div>
                                )}
                                {prod.type === "non_veg" && (
                                  <div className="w-3 h-3 rounded-full bg-red-500 border border-white outline outline-1 outline-red-500 shrink-0"></div>
                                )}
                              </div>
                              <div className="font-bold text-brand mb-2">₹{prod.price}</div>
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <div
                                    className={`w-10 h-5 rounded-full relative transition-colors ${
                                      prod.is_available ? "bg-green-500" : "bg-gray-300"
                                    }`}
                                  >
                                    <div
                                      className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${
                                        prod.is_available ? "left-[22px]" : "left-0.5"
                                      }`}
                                    ></div>
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

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => openEditProductModal(prod, cat.id)}
                                    className="text-gray-400 hover:text-brand transition-colors p-1.5 rounded-lg hover:bg-gray-50"
                                    title="Edit Product"
                                  >
                                    <i className="fa-solid fa-pen-to-square"></i>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProduct(prod.id, prod.name)}
                                    className="text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                                    title="Delete Product"
                                  >
                                    <i className="fa-solid fa-trash-can text-sm"></i>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                        <p className="text-sm font-medium text-gray-400 mb-2">No items in this category yet</p>
                        <button
                          onClick={() => openAddProductModal(cat.id)}
                          className="text-xs font-bold text-brand hover:underline"
                        >
                          + Add first item to {cat.name}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
                  <div className="w-16 h-16 bg-brand/10 text-brand rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
                    <i className="fa-solid fa-utensils"></i>
                  </div>
                  <h3 className="text-lg font-bold text-[#2b1b10] mb-2">Your menu is empty</h3>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
                    Start by creating a category (e.g. Beverages, Snacks, Main Course) and then add your dishes.
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => {
                        setCategoryName("");
                        setIsAddingCategory(true);
                      }}
                      className="bg-brand text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md hover:bg-brand-dark transition-colors"
                    >
                      + Create First Category
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Add / Edit Product Modal */}
      {(isAddingProduct || editingProduct) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[#2b1b10]">
                {editingProduct ? "Edit Product" : "Add New Product"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsAddingProduct(false);
                  setEditingProduct(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={editingProduct ? handleEditProduct : handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Product Name *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Butter Paneer Roll"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Price (₹) *
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 120"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all"
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Category *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCategory(true);
                    }}
                    className="text-xs font-bold text-brand hover:underline"
                  >
                    + New Category
                  </button>
                </div>
                <select
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all"
                  value={productCategoryId}
                  onChange={(e) => setProductCategoryId(e.target.value)}
                >
                  <option value="">-- Select Category --</option>
                  {data?.categories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Product Image (Optional)
                </label>
                <div className="border border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-brand transition-colors bg-gray-50/50">
                  <input
                    type="file"
                    accept="image/*"
                    id="product-img-upload"
                    className="hidden"
                    onChange={(e) => setProductImage(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="product-img-upload" className="cursor-pointer flex flex-col items-center gap-1.5">
                    <i className="fa-solid fa-cloud-arrow-up text-xl text-gray-400"></i>
                    <span className="text-xs font-medium text-gray-600">
                      {productImage ? productImage.name : "Click to select food image"}
                    </span>
                    <span className="text-[10px] text-gray-400">PNG, JPG, WEBP up to 5MB</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingProduct(false);
                    setEditingProduct(null);
                  }}
                  disabled={submittingProduct}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingProduct}
                  className="flex-1 bg-brand hover:bg-brand-dark text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {submittingProduct ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingProduct ? "Update Product" : "Add Product"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {isAddingCategory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[#2b1b10]">Create Category</h2>
              <button
                type="button"
                onClick={() => setIsAddingCategory(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Category Name *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Shakes, Sandwiches, Burgers"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(false)}
                  disabled={submittingCategory}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCategory}
                  className="flex-1 bg-brand hover:bg-brand-dark text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {submittingCategory ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Category</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}