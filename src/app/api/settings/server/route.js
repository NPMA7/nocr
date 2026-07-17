import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { resolveAuth } from "@/lib/auth";
import { hasAccess } from "@/lib/roles";

const getFilePath = () => path.join(process.cwd(), "data", "server-settings.json");

export async function GET(request) {
  try {
    let user;
    try {
      user = await resolveAuth(request);
    } catch (e) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasAccess(user, "settings-system", "read") && !hasAccess(user, "laporan-harian", "read")) {
      return NextResponse.json({ error: "Akses Ditolak: Membaca Konfigurasi Server" }, { status: 403 });
    }

    const filePath = getFilePath();
    let settingsData = {};
    try {
      const dataStr = await fs.readFile(filePath, "utf-8");
      settingsData = JSON.parse(dataStr);
    } catch (e) {
      settingsData = {
        standard_issues: [
          "Mati Listrik / Pemadaman",
          "Kabel Power / Adaptor Terlepas / Rusak",
          "Stop Kontak / Terminal Longgar",
          "ONT Loss / FO Cut / Gangguan Kabel",
          "Kabel UTP / LAN Bermasalah / Loop",
          "Perangkat Hang / Telat Sinkronisasi",
          "Sedang Renovasi / Perbaikan Bangunan",
          "Relokasi Perangkat / ONT / AP",
          "Gangguan Massal / ISP Down"
        ],
        min_offline_duration_minutes: 10,
        ping_interval_seconds: 5,
        ping_timeout_seconds: 15,
        core_broadcast_interval_seconds: 10,
        sync_ruijie_interval_seconds: 60,
        sync_mikrotik_interval_seconds: 60,
        sync_mappings_interval_seconds: 60,
        alarm_delay_ms: 1500,
        alarm_sound: "beep"
      };
    }

    return NextResponse.json(settingsData);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    let user;
    try {
      user = await resolveAuth(request);
    } catch (e) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasAccess(user, "settings-system", "update")) {
      return NextResponse.json({ error: "Akses Ditolak: Mengubah Konfigurasi Server" }, { status: 403 });
    }

    const body = await request.json();
    const filePath = getFilePath();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid data body" }, { status: 400 });
    }

    await fs.writeFile(filePath, JSON.stringify(body, null, 2), "utf-8");

    return NextResponse.json({ success: true, data: body });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
