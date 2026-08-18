"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
import { getApiUrl } from "@/lib/utils";

export default function PasswordResetConfirmPage() {
  const params = useParams<{ uid: string; token: string }>();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isValidLink, setIsValidLink] = useState<boolean | null>(null);

  useEffect(() => {
    const checkLink = async () => {
      const uid = params.uid;
      const token = params.token;

      if (!uid || !token) {
        setIsValidLink(false);
        return;
      }

      try {
        const res = await fetch(`${getApiUrl()}/app/password-reset-confirm/${uid}/${token}/`, {
          method: "GET",
          credentials: "omit",
        });

        const text = await res.text();
        const isValid = res.ok && (text.toLowerCase().includes("new password") || text.toLowerCase().includes("confirm password"));
        setIsValidLink(isValid);
      } catch (err) {
        console.error(err);
        setIsValidLink(false);
      }
    };

    checkLink();
  }, [params.uid, params.token]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    try {
      const body = new URLSearchParams({
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      const res = await fetch(`${getApiUrl()}/app/password-reset-confirm/${params.uid}/${params.token}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "text/html",
        },
        credentials: "omit",
        body: body.toString(),
        redirect: "follow",
      });

      const finalUrl = res.url || "";
      if (res.ok || finalUrl.includes("/login") || finalUrl.includes("/accounts/login/")) {
        setMessage("Password reset successful. Redirecting to login...");
        setTimeout(() => {
          router.push("/login");
        }, 1800);
        return;
      }

      const text = await res.text();
      if (text.toLowerCase().includes("successfully reset") || text.toLowerCase().includes("logged in")) {
        setMessage("Password reset successful. Redirecting to login...");
        setTimeout(() => {
          router.push("/login");
        }, 1800);
        return;
      }

      setError("Unable to reset password with this link. Please request a new one.");
    } catch (err) {
      console.error(err);
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidLink === false) {
    return (
      <AuthLayout title="Reset Link Invalid" subtitle="This password reset link is no longer valid">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-medium text-red-700">
          This password reset link is invalid or has already been used.
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set New Password" subtitle="Choose a new secure password">
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
          <label className="mb-1.5 ml-1 block text-sm font-semibold text-[#2b1b10]">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="bb-input"
            placeholder="Enter a new password"
          />
        </div>

        <div>
          <label className="mb-1.5 ml-1 block text-sm font-semibold text-[#2b1b10]">Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="bb-input"
            placeholder="Confirm your new password"
          />
        </div>

        <button type="submit" className="bb-btn" disabled={isLoading}>
          {isLoading ? "Updating..." : "Update password"}
        </button>
      </form>
    </AuthLayout>
  );
}
