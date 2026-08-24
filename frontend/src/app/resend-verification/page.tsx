"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthLayout from "@/components/AuthLayout";
import { getApiUrl } from "@/lib/utils";

export default function ResendVerificationPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");
    setError("");

    try {
      const body = new URLSearchParams({ email });
      const res = await fetch(`${getApiUrl()}/app/resend-verification/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        credentials: "omit",
        body: body.toString(),
      });

      const text = await res.text();
      const finalUrl = res.url || "";

      if (res.ok || res.redirected || finalUrl.includes("/login") || text.toLowerCase().includes("verification email sent") || text.toLowerCase().includes("already verified")) {
        setMessage("Verification email sent. Check your inbox and then log in.");
        setTimeout(() => {
          router.push("/login");
        }, 1800);
        return;
      }

      setError("Could not send the verification email. Please try again.");
    } catch (err) {
      console.error(err);
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Resend Verification" subtitle="Enter the email used during signup">
      {message && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-3 py-3 text-sm font-medium text-green-700">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 ml-1 block text-sm font-semibold text-[#2b1b10]">Email</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
              <i className="fa-solid fa-envelope"></i>
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bb-input pl-10"
              placeholder="Enter your email address"
            />
          </div>
        </div>

        <button type="submit" className="bb-btn" disabled={isLoading}>
          {isLoading ? "Sending..." : "Send verification link"}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        <Link href="/login" className="font-semibold text-brand hover:text-brand-dark">
          Back to login
        </Link>
      </div>
    </AuthLayout>
  );
}
