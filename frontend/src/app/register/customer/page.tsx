"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
import Link from "next/link";
import { fetchWithCSRF } from "@/lib/csrf";
import { getApiUrl } from "@/lib/utils";

export default function CustomerRegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password1: "",
    password2: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string[] }>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    setFieldErrors({});

    try {
      const data = new URLSearchParams();
      data.append("username", formData.username);
      data.append("email", formData.email);
      data.append("password1", formData.password1);
      data.append("password2", formData.password2);

      const res = await fetchWithCSRF(`${getApiUrl()}/app/register/customer/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        credentials: "omit",
        body: data,
      });

      const contentType = res.headers.get("content-type");
      if (!res.ok || !contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response from server during customer registration:", text.substring(0, 1000));
        setErrorMsg(`Server returned an error (${res.status}). Please check console logs.`);
        return;
      }

      const resData = await res.json();
      
      if (resData.success) {
        setSuccessMsg(resData.msg || "Registration successful. Please log in.");
        // Redirect to Next.js login page or let them click
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      } else {
        if (resData.msg) setErrorMsg(resData.msg);
        if (resData.errors) setFieldErrors(resData.errors);
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
      title="Create Account"
      subtitle="Join Bhukkad Box as a Customer"
    >
      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded-xl flex items-start gap-2 text-sm font-medium">
          <i className="fa-solid fa-check-circle mt-0.5"></i>
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 relative">
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
              name="username"
              className="bb-input pl-10"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#2b1b10] mb-1.5 ml-1">Email</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <i className="fa-solid fa-envelope"></i>
            </div>
            <input
              type="email"
              name="email"
              className="bb-input pl-10"
              placeholder="Email address"
              value={formData.email}
              onChange={handleChange}
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
              name="password1"
              className="bb-input pl-10"
              placeholder="Create password"
              value={formData.password1}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#2b1b10] mb-1.5 ml-1">Confirm Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <i className="fa-solid fa-lock"></i>
            </div>
            <input
              type="password"
              name="password2"
              className="bb-input pl-10"
              placeholder="Confirm password"
              value={formData.password2}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <button type="submit" className="bb-btn mt-2" disabled={isLoading}>
          {isLoading ? "Creating..." : "Sign Up"}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-3">
        <div className="text-sm text-gray-500 font-medium">Already have an account?</div>
        <Link href="/login" className="text-brand font-semibold hover:text-brand-dark transition-colors">
          Log in instead
        </Link>
      </div>
    </AuthLayout>
  );
}
