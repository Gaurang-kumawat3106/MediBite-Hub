import React from 'react';

export default function AuthLayout({ children, title, subtitle }: { children: React.ReactNode, title: React.ReactNode, subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-10 px-4">
      {/* Dark brown header block */}
      <div className="relative w-full max-w-[420px] bg-[#2b1b10] text-white rounded-t-3xl pt-10 pb-12 px-8 text-center shadow-xl z-10">
        <div className="text-3xl font-heading font-bold mb-2 tracking-tight text-white">
          Bhukkad <span className="text-brand">Box</span>
        </div>
        <div className="text-sm font-sans font-light text-[#d4ccc4] tracking-wide">
          Fresh Meals, Freshly Ordered
        </div>

        {/* Floating cutlery icon */}
        <div className="absolute left-1/2 -bottom-6 -translate-x-1/2 w-12 h-12 bg-brand rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(232,93,32,0.4)] border-4 border-[#2b1b10] z-20">
          <i className="fa-solid fa-utensils text-white text-sm"></i>
        </div>
      </div>

      {/* White card */}
      <div className="w-full max-w-[420px] bg-white rounded-b-3xl rounded-t-xl -mt-4 pt-12 pb-8 px-8 shadow-xl z-0">
        <h1 className="text-2xl font-heading font-bold text-[#2b1b10] mb-1">{title}</h1>
        <p className="text-[#6b5c51] text-sm mb-6">{subtitle}</p>
        
        {children}
      </div>
    </div>
  );
}
