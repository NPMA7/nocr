import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { resolveAuth } from "@/lib/auth";
import { hasAccess } from "@/lib/roles";

function getCandidateFiles() {
  return [
    path.join(process.cwd(), "backend", "data", "topology_architectures.json"),
    path.join(process.cwd(), "data", "topology_architectures.json"),
    "/app/backend/data/topology_architectures.json",
    "/app/data/topology_architectures.json",
    "/var/www/nocr/backend/data/topology_architectures.json",
    "/var/www/nocr/data/topology_architectures.json",
    path.join(process.cwd(), "..", "backend", "data", "topology_architectures.json"),
    path.join(process.cwd(), "src", "data", "topology_architectures.json"),
  ];
}

function getFilePath() {
  const candidates = getCandidateFiles();

  // 1. Return first candidate that already exists and has substantial content (> 100 bytes)
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const stat = fs.statSync(file);
        if (stat.size > 100) {
          return file;
        }
      }
    } catch (e) {}
  }

  // 2. Return first candidate that already exists
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        return file;
      }
    } catch (e) {}
  }

  // 3. Fallback to preferred directory
  const possibleDirs = [
    path.join(process.cwd(), "backend", "data"),
    path.join(process.cwd(), "data"),
    "/app/backend/data",
    "/app/data",
    "/var/www/nocr/backend/data",
    "/var/www/nocr/data",
    "/tmp",
  ];

  for (const dir of possibleDirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return path.join(dir, "topology_architectures.json");
    } catch (e) {}
  }
  return path.join(process.cwd(), "topology_architectures.json");
}

function getStoredData() {
  const candidates = getCandidateFiles();

  // Look across all candidates for one that has non-empty architectures
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.architectures) && parsed.architectures.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
  }

  const filePath = getFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.architectures)) {
        return parsed;
      }
    } catch (e) {}
  }

  return { activeId: null, architectures: [] };
}

function saveStoredData(data) {
  const filePath = getFilePath();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");

  // Also sync to all existing candidate directories so no data is lost across mounts
  const candidates = getCandidateFiles();
  for (const target of candidates) {
    try {
      if (target !== filePath && fs.existsSync(path.dirname(target))) {
        fs.writeFileSync(target, JSON.stringify(data, null, 2), "utf8");
      }
    } catch (e) {}
  }
}

export async function GET(req) {
  try {
    const user = await resolveAuth(req);
    if (!hasAccess(user, "topology", "read") && !hasAccess(user, "maps", "read")) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const data = getStoredData();
    return NextResponse.json(data);
  } catch (e) {
    console.error("Gagal membaca topologi arsitektur:", e);
    return NextResponse.json(
      { activeId: null, architectures: [] },
      { status: 200 }
    );
  }
}

export async function POST(req) {
  try {
    const user = await resolveAuth(req);
    if (!hasAccess(user, "topology", "update") && !hasAccess(user, "topology", "create")) {
      return NextResponse.json(
        { error: "Akses ditolak: Anda tidak memiliki izin untuk mengedit topologi" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, name, description, category, nodes, links, areas, activeId, defaultId, is_default } = body;

    const data = getStoredData();

    if (defaultId !== undefined) {
      data.defaultId = defaultId;
      data.architectures = (data.architectures || []).map((a) => ({
        ...a,
        is_default: a.id === defaultId,
      }));
    }

    if (activeId) {
      data.activeId = activeId;
    }

    if (id && Array.isArray(nodes)) {
      let existingIdx = data.architectures.findIndex((a) => a.id === id);
      if (existingIdx < 0 && name) {
        existingIdx = data.architectures.findIndex(
          (a) => a.name.trim().toLowerCase() === name.trim().toLowerCase()
        );
      }

      const targetId = existingIdx >= 0 ? data.architectures[existingIdx].id : id;
      const targetIsDefault =
        is_default !== undefined
          ? is_default
          : existingIdx >= 0
          ? data.architectures[existingIdx].is_default || false
          : false;

      const entry = {
        id: targetId,
        name: name || "Skema Topologi",
        description: description || "",
        category: category || "Kustom",
        is_default: targetIsDefault,
        nodes: nodes || [],
        links: links || [],
        areas: areas || [],
        updatedAt: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        data.architectures[existingIdx] = entry;
      } else {
        data.architectures.unshift(entry);
      }
      data.activeId = targetId;
    }

    saveStoredData(data);
    if (global.io) {
      global.io.emit("topology_architecture_updated", data);
    }
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("Gagal menyimpan topologi arsitektur:", e);
    return NextResponse.json(
      { error: "Gagal menyimpan arsitektur topologi: " + (e.message || "") },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    const user = await resolveAuth(req);
    if (!hasAccess(user, "topology", "delete")) {
      return NextResponse.json(
        { error: "Akses ditolak: Anda tidak memiliki izin untuk menghapus topologi" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID wajib diisi" }, { status: 400 });
    }

    const data = getStoredData();
    data.architectures = (data.architectures || []).filter((a) => a.id !== id);

    if (data.defaultId === id) {
      data.defaultId = null;
    }

    if (data.activeId === id && data.architectures.length > 0) {
      data.activeId = data.architectures[0].id;
    } else if (data.activeId === id) {
      data.activeId = null;
    }

    saveStoredData(data);
    if (global.io) {
      global.io.emit("topology_architecture_updated", data);
    }
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("Gagal menghapus topologi arsitektur:", e);
    return NextResponse.json(
      { error: "Gagal menghapus arsitektur topologi" },
      { status: 500 }
    );
  }
}
