"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { fetchWithCSRF } from "@/lib/csrf";
import { getApiUrl } from "@/lib/utils";

export default function OutletSidebar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await fetchWithCSRF(`${getApiUrl()}/app/logout/`, {
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

  const navItems = [
    { name: "Dashboard", href: "/outlet/home", icon: "fa-chart-simple" },
    { name: "Live Orders", href: "/outlet/orders", icon: "fa-bell" },
    { name: "Order History", href: "/outlet/delivered", icon: "fa-clock-rotate-left" },
    { name: "Products", href: "/outlet/products", icon: "fa-box-open" },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex-col hidden md:flex shrink-0 min-h-screen">
        <div className="p-6 border-b border-gray-100">
          <Link href="/outlet/home" className="text-xl font-bold font-heading text-brand flex items-center gap-2">
            <i className="fa-solid fa-utensils"></i> Bhukkad Box
          </Link>
          <div className="text-xs text-gray-400 font-bold tracking-wider uppercase mt-1">Outlet Partner</div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link 
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                  isActive 
                    ? "bg-brand text-white shadow-md shadow-brand/20" 
                    : "text-gray-500 hover:bg-orange-50 hover:text-brand"
                }`}
              >
                <i className={`fa-solid ${item.icon} w-5`}></i>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl font-bold text-sm transition-all"
          >
            <i className="fa-solid fa-arrow-right-from-bracket w-5"></i>
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-100 flex items-center justify-around py-2 px-2 shadow-lg">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link 
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs font-bold transition-all ${
                isActive ? "text-brand" : "text-gray-400 hover:text-[#2b1b10]"
              }`}
            >
              <i className={`fa-solid ${item.icon} text-lg mb-1`}></i>
              <span className="text-[10px] tracking-tight">{item.name}</span>
            </Link>
          );
        })}
        <button 
          onClick={handleLogout}
          className="flex flex-col items-center justify-center p-2 rounded-xl text-xs font-bold text-red-400 hover:text-red-600 transition-all"
          title="Logout"
        >
          <i className="fa-solid fa-arrow-right-from-bracket text-lg mb-1"></i>
          <span className="text-[10px] tracking-tight">Logout</span>
        </button>
      </div>
    </>
  );
}