"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function OrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("OrdersPage Error Boundary caught error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-gray-100 shadow-sm space-y-6">
        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto text-3xl">
          <i className="fa-solid fa-triangle-exclamation"></i>
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold font-heading text-[#2b1b10]">
            Unable to load orders
          </h2>
          <p className="text-gray-500 text-sm">
            {error?.message || "Something went wrong while loading your orders page."}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="w-full bg-brand text-white py-3.5 rounded-xl font-bold hover:bg-brand-dark transition-colors shadow-sm"
          >
            Try again
          </button>
          <Link
            href="/customer/home"
            className="w-full bg-gray-100 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-200 transition-colors"
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
