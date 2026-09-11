"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { getDefaultAccessibleRoute, applySessionUser, clearClientAuth } from "@/lib/roles";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    axios.get("/api/auth/me")
      .then((res) => {
        if (res.data?.user) {
          const userObj = applySessionUser(res.data.user);
          router.replace(getDefaultAccessibleRoute(userObj));
        } else {
          clearClientAuth();
          router.replace("/login");
        }
      })
      .catch(() => {
        clearClientAuth();
        router.replace("/login");
      });
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );
}
