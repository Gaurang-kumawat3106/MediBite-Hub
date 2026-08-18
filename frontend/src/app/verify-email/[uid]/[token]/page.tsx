"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
import { getApiUrl } from "@/lib/utils";

export default function VerifyEmailPage() {
  const params = useParams<{ uid: string; token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState("Verifying your email...");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const run = async () => {
      const uid = params.uid;
      const token = params.token;

      if (!uid || !token) {
        setStatus("Invalid verification link.");
        setIsError(true);
        return;
      }

      try {
        const res = await fetch(`${getApiUrl()}/app/verify-email/${uid}/${token}/`, {
          method: "GET",
          credentials: "omit",
        });

        const text = await res.text();
        const finalUrl = res.url || "";

        if (res.ok || finalUrl.includes("/login") || text.toLowerCase().includes("verified") || text.toLowerCase().includes("success")) {
          setStatus("Your email has been verified successfully.");
          setTimeout(() => {
            router.push("/login");
          }, 2000);
          return;
        }

        setStatus("This verification link is invalid or has expired.");
        setIsError(true);
      } catch (err) {
        console.error(err);
        setStatus("Something went wrong while verifying your email.");
        setIsError(true);
      }
    };

    run();
  }, [params.uid, params.token, router]);

  return (
    <AuthLayout title="Email Verification" subtitle="Checking your verification link">
      <div className={`rounded-xl border px-4 py-4 text-sm font-medium ${isError ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
        {status}
      </div>
    </AuthLayout>
  );
}
