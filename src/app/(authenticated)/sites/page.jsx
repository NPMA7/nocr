"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SitesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/sites/desa");
  }, [router]);

  return (
    <div className="p-6 text-slate-400 text-xs">
      Redirecting to L2TP (Desa) Wilayah...
    </div>
  );
}
