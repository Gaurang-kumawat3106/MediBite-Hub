"use client";

import { useState } from "react";
import Link from "next/link";

export default function Footer() {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const openModal = (e: React.MouseEvent, policy: string) => {
    e.preventDefault();
    setActiveModal(policy);
    document.body.style.overflow = "hidden";
  };

  const closeModal = () => {
    setActiveModal(null);
    document.body.style.overflow = "auto";
  };

  return (
    <>
      <footer className="bg-white border-t border-gray-100 pt-12 pb-6 mt-12 w-full max-w-4xl mx-auto rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
        <div className="px-6 flex flex-col md:flex-row gap-10 justify-between items-start">
          {/* Brand & About */}
          <div className="flex flex-col gap-4 max-w-sm">
            <h3 className="text-xl font-bold font-heading text-[#2b1b10] flex items-center gap-2">
              <i className="fa-solid fa-utensils text-brand"></i> Bhukkad Box
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Welcome to Bhukkad Box, your trusted college canteen ordering platform.
              We provide a fast and easy way for students and staff to order fresh and tasty food online. 
            </p>
            <ul className="text-sm text-gray-600 flex flex-col gap-2 mt-2">
              <li className="flex items-center gap-2"><i className="fa-solid fa-check text-[#4ade80]"></i> Fresh & hygienic food</li>
              <li className="flex items-center gap-2"><i className="fa-solid fa-check text-[#4ade80]"></i> Quick ordering system</li>
              <li className="flex items-center gap-2"><i className="fa-solid fa-check text-[#4ade80]"></i> Secure payments via Razorpay</li>
              <li className="flex items-center gap-2"><i className="fa-solid fa-check text-[#4ade80]"></i> Easy pickup</li>
            </ul>
          </div>

          {/* Links (Policy) */}
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-bold font-heading text-[#2b1b10]">Policies</h3>
            <ul className="flex flex-col gap-3 text-sm font-medium text-gray-500">
              <li>
                <button onClick={(e) => openModal(e, 'privacy')} className="hover:text-brand transition-colors text-left">
                  Privacy Policy
                </button>
              </li>
              <li>
                <button onClick={(e) => openModal(e, 'terms')} className="hover:text-brand transition-colors text-left">
                  Terms & Conditions
                </button>
              </li>
              <li>
                <button onClick={(e) => openModal(e, 'refund')} className="hover:text-brand transition-colors text-left">
                  Refund & Cancellation
                </button>
              </li>
            </ul>
          </div>

          {/* Contact Us */}
          <div className="flex flex-col gap-4 max-w-sm">
            <h3 className="text-lg font-bold font-heading text-[#2b1b10]">Contact Us</h3>
            <p className="text-sm text-gray-500">We’re here to help you with orders, payments, and support.</p>
            <ul className="flex flex-col gap-3 text-sm text-gray-600 mt-2">
              <li className="flex items-start gap-2"><i className="fa-solid fa-user mt-1 text-gray-400"></i> <span>Founders: Gaurang Kumawat & Bodh Morya</span></li>
              <li className="flex items-center gap-2"><i className="fa-solid fa-envelope text-gray-400"></i> <a href="mailto:gaurangkumawat026@gmail.com" className="hover:text-brand">gaurangkumawat026@gmail.com</a></li>
              <li className="flex items-center gap-2"><i className="fa-solid fa-phone text-gray-400"></i> <a href="tel:+918640006268" className="hover:text-brand">+91 8640006268</a></li>
              <li className="flex items-start gap-2"><i className="fa-solid fa-location-dot mt-1 text-gray-400"></i> <span>College Canteen,<br/>Medi-Caps University, Indore</span></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-6 border-t border-gray-100 text-center text-sm font-medium text-gray-400">
          <p>&copy; {new Date().getFullYear()} Bhukkad Box. All rights reserved.</p>
        </div>
      </footer>

      {/* Policy Modals */}
      {activeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={closeModal}>
          <div 
            className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold font-heading text-[#2b1b10]">
                {activeModal === 'privacy' && 'Privacy Policy'}
                {activeModal === 'terms' && 'Terms & Conditions'}
                {activeModal === 'refund' && 'Refund & Cancellation'}
              </h2>
              <button 
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-gray-600 prose prose-sm prose-orange">
              
              {activeModal === 'privacy' && (
                <>
                  <p>At Bhukkad Box, we respect your privacy and are committed to protecting your personal information.</p>
                  <h3 className="text-lg font-bold text-gray-900 mt-4 mb-2">Information We Collect</h3>
                  <ul className="list-disc pl-5 mb-4 space-y-1">
                    <li>Name, Phone Number, Email Address</li>
                    <li>Order Details</li>
                    <li>Payment Transaction Details (through Razorpay)</li>
                  </ul>
                  <h3 className="text-lg font-bold text-gray-900 mt-4 mb-2">How We Use Your Information</h3>
                  <ul className="list-disc pl-5 mb-4 space-y-1">
                    <li>Processing and confirming your order</li>
                    <li>Delivering food to the correct customer</li>
                    <li>Contacting you regarding order updates</li>
                  </ul>
                  <h3 className="text-lg font-bold text-gray-900 mt-4 mb-2">Payment Security</h3>
                  <p className="mb-4">All online payments are securely processed through Razorpay. We do not store your card, UPI, or banking details on our website.</p>
                </>
              )}

              {activeModal === 'terms' && (
                <>
                  <p>By using our website Bhukkad Box, you agree to the following terms and conditions.</p>
                  <h3 className="text-lg font-bold text-gray-900 mt-4 mb-2">Order Rules</h3>
                  <ul className="list-disc pl-5 mb-4 space-y-1">
                    <li>Orders can be placed through our website/app.</li>
                    <li>Once an order is confirmed, it will be prepared immediately.</li>
                    <li>Customers must provide correct details (name, phone, etc.) while ordering.</li>
                  </ul>
                  <h3 className="text-lg font-bold text-gray-900 mt-4 mb-2">Pricing & Availability</h3>
                  <ul className="list-disc pl-5 mb-4 space-y-1">
                    <li>Food items are subject to availability.</li>
                    <li>Prices may change anytime without prior notice.</li>
                  </ul>
                  <h3 className="text-lg font-bold text-gray-900 mt-4 mb-2">Cancellation Policy</h3>
                  <p className="mb-4">Order cancellation is allowed only if the order is not prepared yet. If the food preparation has started, cancellation is not possible.</p>
                </>
              )}

              {activeModal === 'refund' && (
                <>
                  <p>At Bhukkad Box, customer satisfaction is important to us.</p>
                  <h3 className="text-lg font-bold text-gray-900 mt-4 mb-2">Cancellation Policy</h3>
                  <ul className="list-disc pl-5 mb-4 space-y-1">
                    <li>You can cancel your order only before it is confirmed or before preparation starts.</li>
                    <li>Once the order is confirmed and preparation has started, it cannot be cancelled.</li>
                  </ul>
                  <h3 className="text-lg font-bold text-gray-900 mt-4 mb-2">Refund Policy</h3>
                  <ul className="list-disc pl-5 mb-4 space-y-1">
                    <li>No refunds will be provided after the order is confirmed.</li>
                    <li>Refunds are applicable if payment was deducted but the order wasn't placed, due to a technical error, or if the order is cancelled by the canteen.</li>
                  </ul>
                  <h3 className="text-lg font-bold text-gray-900 mt-4 mb-2">Refund Processing Time</h3>
                  <p className="mb-4">If refund is applicable, it will be processed within 5–7 working days to the original payment method.</p>
                </>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}
