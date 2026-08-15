"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Script from "next/script";
import Footer from "@/components/Footer";

const getImageUrl = (url: string | null) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `http://localhost:8000${url}`;
};

interface CartItem {
  id: number;
  product_id: number;
  product_name: string;
  product_price: number;
  quantity: number;
  total_price: number;
  outlet_name: string;
  image_url: string | null;
  is_available: boolean;
}

interface CartData {
  success: boolean;
  items: CartItem[];
  total: number;
  can_order: boolean;
  razorpay_key_id: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CartPage() {
  const router = useRouter();
  const [data, setData] = useState<CartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchCart = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const res = await fetch("http://localhost:8000/app/cart/", {
        headers: {
          "Accept": "application/json",
        },
        credentials: "include"
      });

      if (res.status === 403 || res.status === 401 ) {
        window.location.href = "/login";
        return;
      }

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        window.location.href = "/login";
        return;
      }

      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError("Failed to load cart.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Please make sure the Django server is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart(true);
  }, []);

  const handleActionOptimistic = async (action: 'increase' | 'decrease' | 'remove', itemId: number) => {
    if (!data) return;
    
    // Deep copy for rollback
    const originalData = JSON.parse(JSON.stringify(data));
    const newData = { ...data, items: [...data.items] };
    const itemIndex = newData.items.findIndex(i => i.id === itemId);
    
    if (itemIndex > -1) {
      const item = { ...newData.items[itemIndex] };
      if (action === 'increase') {
        item.quantity += 1;
        item.total_price = item.quantity * item.product_price;
        newData.items[itemIndex] = item;
      } else if (action === 'decrease') {
        item.quantity -= 1;
        item.total_price = item.quantity * item.product_price;
        if (item.quantity <= 0) {
          newData.items.splice(itemIndex, 1);
        } else {
          newData.items[itemIndex] = item;
        }
      } else if (action === 'remove') {
        newData.items.splice(itemIndex, 1);
      }
      
      newData.total = newData.items.reduce((sum, i) => sum + i.total_price, 0);
      newData.can_order = newData.items.length > 0 && newData.items.every(i => i.is_available);
      setData(newData);
    }
    
    const urlMap = {
      'increase': `http://localhost:8000/app/cart/increase/${itemId}/`,
      'decrease': `http://localhost:8000/app/cart/decrease/${itemId}/`,
      'remove': `http://localhost:8000/app/remove-from-cart/${itemId}/`
    };
    
    try {
      await fetch(urlMap[action], {
        method: "POST",
        headers: { "Accept": "application/json" },
        credentials: "include"
      });
      // Sync background exactly with server logic
      fetchCart(false);
    } catch (e) {
      console.error(e);
      setData(originalData); // Rollback on network error
    }
  };

  const handleCheckout = async () => {
    setProcessing(true);
    try {
      const res = await fetch("http://localhost:8000/app/payment/create/", {
        method: "POST",
        headers: { "Accept": "application/json" },
        credentials: "include"
      });
      const resData = await res.json();
      
      if (!resData.success) {
        alert(resData.error || "Failed to create order");
        setProcessing(false);
        return;
      }

      const options = {
        key: resData.key,
        amount: resData.amount,
        currency: "INR",
        name: "Bhukkad Box",
        description: "Order Payment",
        order_id: resData.razorpay_order_id,
        handler: async function (response: any) {
          try {
            const formData = new URLSearchParams();
            formData.append("razorpay_payment_id", response.razorpay_payment_id);
            formData.append("razorpay_order_id", response.razorpay_order_id);
            formData.append("razorpay_signature", response.razorpay_signature);

            const verifyRes = await fetch("http://localhost:8000/app/payment/callback/", {
              method: "POST",
              headers: { 
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded"
              },
              body: formData.toString(),
              credentials: "include"
            });
            const verifyData = await verifyRes.json();
            
            if (verifyData.success && verifyData.redirect_url) {
              router.push(verifyData.redirect_url);
            } else {
              alert(verifyData.error || "Payment verification failed.");
              setProcessing(false);
            }
          } catch (err) {
            console.error(err);
            alert("Network error during verification.");
            setProcessing(false);
          }
        },
        theme: { color: "#3b82f6" }
      };

      const rzp1 = new window.Razorpay(options);
      rzp1.on("payment.failed", function (response: any) {
        alert("Payment Failed: " + response.error.description);
        setProcessing(false);
      });
      rzp1.open();
    } catch (e) {
      console.error(e);
      alert("Something went wrong with checkout.");
      setProcessing(false);
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
    <div className="min-h-screen bg-[#faf9f6] flex flex-col relative">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      {processing && (
        <div className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin mb-4"></div>
          <p className="font-bold font-heading text-lg">Processing payment...</p>
        </div>
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 flex items-center px-6 py-4">
        <Link href="/customer/home" className="flex items-center gap-3 text-[#2b1b10] hover:text-brand transition-colors font-bold text-sm">
          <i className="fa-solid fa-arrow-left"></i> Home
        </Link>
        <div className="flex-1 text-center font-bold font-heading text-lg text-[#2b1b10]">
          <i className="fa-solid fa-cart-shopping text-brand mr-2"></i> My Cart
        </div>
        <div className="w-[60px]"></div> {/* Spacer */}
      </nav>

      <div className="flex-1 w-full max-w-4xl mx-auto px-6 py-8">
        {data?.items && data.items.length > 0 ? (
          <div className="flex flex-col md:flex-row gap-8">
            
            {/* Items Column */}
            <div className="flex-1 flex flex-col gap-4">
              {data.items.map(item => (
                <div key={item.id} className={`bg-white rounded-3xl p-4 border border-gray-100 flex gap-4 shadow-sm relative ${!item.is_available ? 'opacity-50' : ''}`}>
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {item.image_url ? (
                      <img src={getImageUrl(item.image_url) as string} alt={item.product_name} className="w-full h-full object-cover" />
                    ) : (
                      <i className="fa-solid fa-bowl-food text-gray-300 text-xl"></i>
                    )}
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{item.outlet_name}</div>
                    <div className="font-bold font-heading text-[#2b1b10] leading-tight mb-1 pr-8">{item.product_name}</div>
                    <div className="text-sm text-brand font-bold">₹{item.product_price} each</div>
                  </div>

                  <div className="flex flex-col items-end justify-between">
                    <button 
                      onClick={() => handleActionOptimistic('remove', item.id)}
                      className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                      title="Remove"
                    >
                      <i className="fa-solid fa-trash-can text-sm"></i>
                    </button>
                    
                    <div className="flex items-center gap-3 bg-gray-50 rounded-full px-1 py-1 border border-gray-100 mt-2">
                      <button 
                        onClick={() => handleActionOptimistic('decrease', item.id)}
                        className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center hover:text-brand transition-colors text-sm"
                      >
                        <i className="fa-solid fa-minus text-xs"></i>
                      </button>
                      <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => handleActionOptimistic('increase', item.id)}
                        className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center hover:text-brand transition-colors text-sm"
                      >
                        <i className="fa-solid fa-plus text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary Column */}
            <div className="w-full md:w-[320px] shrink-0">
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm sticky top-[90px]">
                <h3 className="font-bold font-heading text-lg text-[#2b1b10] mb-4 flex justify-between items-center">
                  Order Summary
                  <span className="bg-orange-50 text-brand text-xs px-2 py-1 rounded-lg">
                    {data.items.length} item{data.items.length !== 1 ? 's' : ''}
                  </span>
                </h3>
                
                <div className="flex justify-between items-center text-sm font-medium text-gray-500 mb-4">
                  <span>Subtotal</span>
                  <span className="font-bold text-[#2b1b10]">₹{data.total}</span>
                </div>
                
                <div className="h-px w-full bg-gray-100 mb-4"></div>
                
                <div className="flex justify-between items-center text-lg font-bold font-heading text-[#2b1b10] mb-6">
                  <span>Grand Total</span>
                  <span className="text-brand">₹{data.total}</span>
                </div>

                {data.can_order && data.total > 0 ? (
                  <button 
                    onClick={handleCheckout}
                    className="w-full bg-[#2b1b10] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all shadow-md"
                  >
                    Pay via Razorpay <i className="fa-solid fa-arrow-right text-sm"></i>
                  </button>
                ) : (
                  <button disabled className="w-full bg-gray-100 text-gray-400 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 cursor-not-allowed">
                    Items Unavailable
                  </button>
                )}

                <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-gray-400">
                  <i className="fa-solid fa-shield-halved text-brand"></i> Secure & encrypted checkout
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-20 px-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center text-brand text-4xl mb-6">
              <i className="fa-solid fa-basket-shopping"></i>
            </div>
            <h2 className="text-2xl font-bold font-heading text-[#2b1b10] mb-2">Your cart is empty</h2>
            <p className="text-gray-500 mb-8 max-w-sm">Looks like you haven't added anything delicious yet. Let's fix that!</p>
            <Link href="/customer/home" className="bg-brand text-white px-8 py-4 rounded-2xl font-bold hover:bg-brand-dark hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2">
              <i className="fa-solid fa-utensils"></i> Browse Outlets
            </Link>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
