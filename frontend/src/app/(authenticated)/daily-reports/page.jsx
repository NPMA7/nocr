"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DailyReportsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/report");
  }, [router]);

  return (
    <div className="p-6 text-slate-400 text-xs">
      Redirecting to Reports...
    </div>
  );
}
