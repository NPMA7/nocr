"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DailyReportsDashboardRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/report/dashboard");
  }, [router]);

  return (
    <div className="p-6 text-slate-400 text-xs">
      Redirecting to Report Dashboard...
    </div>
  );
}
