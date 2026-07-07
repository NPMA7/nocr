import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 p-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-5xl font-black text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
          404
        </h1>
        <h2 className="text-lg font-bold text-slate-200">
          Halaman Tidak Ditemukan
        </h2>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          Maaf, halaman yang Anda cari tidak ada atau telah dipindahkan.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs transition shadow-lg shadow-blue-500/20"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}
