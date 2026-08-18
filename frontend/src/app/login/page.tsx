"use client";

import { useState, useEffect, Suspense } from "react";
import AuthLayout from "@/components/AuthLayout";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { fetchWithCSRF } from "@/lib/csrf";
import { getApiUrl } from "@/lib/utils";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string[] }>({});
  const [welcomeName, setWelcomeName] = useState("Guest");

  useEffect(() => {
    const savedName = localStorage.getItem("bb_username");
    if (savedName) {
      setWelcomeName(savedName);
    }

    if (searchParams.get("verified") === "true") {
      setSuccessMsg("Email verified successfully! You can now log in.");
    } else if (searchParams.get("error") === "invalid_token") {
      setErrorMsg("Verification link is invalid or expired. Please request a new one.");
    } else if (searchParams.get("error") === "already_verified") {
      setSuccessMsg("Your email is already verified. Please log in.");
    }
  }, [searchParams]);

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

      const res = await fetchWithCSRF(`${getApiUrl()}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        credentials: "include",
        body: formData,
      });

      const contentType = res.headers.get("content-type");
      if (!res.ok || !contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response from server during login:", text.substring(0, 1000));
        setErrorMsg(`Server returned an error (${res.status}). Please check console logs.`);
        setIsLoading(false);
        return;
      }

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
      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded-xl flex items-start gap-2 text-sm font-medium">
          <i className="fa-solid fa-circle-check mt-0.5"></i>
          <div>{successMsg}</div>
        </div>
      )}

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
          <Link href="/password-reset" className="text-brand font-semibold hover:text-brand-dark transition-colors">
            Forgot password?
          </Link>
        </div>

        <button type="submit" className="bb-btn mt-2" disabled={isLoading}>
          {isLoading ? "Authenticating..." : "Log in"}
        </button>
      </form>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link href="/resend-verification" className="text-sm font-semibold text-[#6b5c51] hover:text-[#2b1b10] transition-colors">
          Haven't received verification link?
        </Link>
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#faf9f6] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand/20 border-t-brand rounded-full animate-spin"></div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
