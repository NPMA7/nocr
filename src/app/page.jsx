"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, getDefaultAccessibleRoute, isClientTokenValid, clearClientAuth } from "@/lib/roles";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("nocr_token") : null;
    if (!token || !isClientTokenValid(token)) {
      clearClientAuth();
      router.replace("/login");
      return;
    }
    const user = getStoredUser();
    const target = getDefaultAccessibleRoute(user);
    router.replace(target || "/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );
}
