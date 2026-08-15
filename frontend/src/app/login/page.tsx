"use client";

import { useState, useEffect } from "react";
import AuthLayout from "@/components/AuthLayout";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string[] }>({});
  const [welcomeName, setWelcomeName] = useState("Guest");

  useEffect(() => {
    const savedName = localStorage.getItem("bb_username");
    if (savedName) {
      setWelcomeName(savedName);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    setFieldErrors({});

    try {
      // Send as x-www-form-urlencoded matching standard Django Form submission
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);
      if (rememberMe) {
        formData.append("remember_me", "on");
      }

      const res = await fetch("http://localhost:8000/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        credentials: "include",
        body: formData,
      });

      const data = await res.json();
      
      if (data.success) {
        if (data.redirect) {
          if (data.role === "outlet") {
            window.location.href = "/outlet/home";
          } else {
            window.location.href = "/customer/home";
          }
        } else {
          window.location.href = "/customer/home";
        }
      } else {
        if (data.msg) setErrorMsg(data.msg);
        if (data.errors) setFieldErrors(data.errors);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout 
      title={
        <>Welcome back, <span className="text-brand">{welcomeName}</span></>
      } 
      subtitle="Log in to access your account"
    >
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-start gap-2 text-sm font-medium">
          <i className="fa-solid fa-circle-exclamation mt-0.5"></i>
          <div>{errorMsg}</div>
        </div>
      )}

      {Object.keys(fieldErrors).length > 0 && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-start gap-2 text-sm font-medium">
          <i className="fa-solid fa-circle-exclamation mt-0.5"></i>
          <div>
            {Object.values(fieldErrors).map((errors, i) =>
              errors.map((err, j) => <div key={`${i}-${j}`}>{err}</div>)
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 relative">
        {/* Fullscreen Loader Overlay (inside form or fixed) */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-xl">
            <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin"></div>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-[#2b1b10] mb-1.5 ml-1">Username</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <i className="fa-solid fa-user"></i>
            </div>
            <input
              type="text"
              className="bb-input pl-10"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#2b1b10] mb-1.5 ml-1">Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <i className="fa-solid fa-lock"></i>
            </div>
            <input
              type="password"
              className="bb-input pl-10"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-sm mt-1">
          <label className="flex items-center gap-2 cursor-pointer text-[#6b5c51] font-medium hover:text-[#2b1b10] transition-colors">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me
          </label>
          <a href="http://localhost:8000/password-reset/" className="text-brand font-semibold hover:text-brand-dark transition-colors">
            Forgot password?
          </a>
        </div>

        <button type="submit" className="bb-btn mt-2" disabled={isLoading}>
          {isLoading ? "Authenticating..." : "Log in"}
        </button>
      </form>

      <div className="mt-8 flex flex-col items-center gap-3">
        <a href="http://localhost:8000/resend-verification/" className="text-sm font-semibold text-[#6b5c51] hover:text-[#2b1b10] transition-colors">
          Haven't received verification link?
        </a>
        <div className="text-sm text-gray-400 font-medium">New here?</div>
        <div className="flex w-full gap-3">
          <Link href="/register/customer" className="flex-1 py-2.5 px-4 text-center rounded-xl bg-gray-50 text-[#2b1b10] text-sm font-semibold border border-gray-200 hover:bg-gray-100 transition-colors">
            Customer register
          </Link>
          <Link href="/register/outlet" className="flex-1 py-2.5 px-4 text-center rounded-xl bg-gray-50 text-[#2b1b10] text-sm font-semibold border border-gray-200 hover:bg-gray-100 transition-colors">
            Outlet head register
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
