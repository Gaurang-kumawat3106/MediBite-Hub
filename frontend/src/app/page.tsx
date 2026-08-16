"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/`, {
          headers: {
            "Accept": "application/json"
          },
          credentials: "include"
        });
        
        const data = await res.json();
        
        if (data.success) {
          if (data.role === "outlet") {
            router.push("/outlet/home");
          } else {
            router.push("/customer/home");
          }
        } else {
          router.push("/login");
        }
      } catch (err) {
        console.error(err);
        router.push("/login");
      }
    }
    
    checkAuth();
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-[#ff6b00]/20 border-t-[#ff6b00] rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-gray-500">Redirecting...</p>
      </div>
    </div>
  );
}
