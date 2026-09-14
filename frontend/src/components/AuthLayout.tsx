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

        {/* Floating brand logo replacing knife and fork */}
        <div className="absolute left-1/2 -bottom-8 -translate-x-1/2 w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-[0_8px_20px_rgba(0,0,0,0.25)] border-4 border-[#2b1b10] z-20 overflow-hidden p-1 transition-transform duration-200 hover:scale-105">
          <img
            src="/icon.png"
            alt="Bhukkad Box Logo"
            className="w-full h-full object-contain rounded-xl"
          />
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
