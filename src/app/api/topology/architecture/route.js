import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { resolveAuth } from "@/lib/auth";
import { hasAccess } from "@/lib/roles";

function getFilePath() {
  const possibleDirs = [
    path.join(process.cwd(), "src", "data"),
    path.join(process.cwd(), "data"),
    "/app/src/data",
    "/tmp",
  ];

  for (const dir of possibleDirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return path.join(dir, "topology_architectures.json");
    } catch (e) {
      // try next
    }
  }
  return path.join(process.cwd(), "topology_architectures.json");
}

function getStoredData() {
  const filePath = getFilePath();
  if (!fs.existsSync(filePath)) {
    const initialData = {
      activeId: null,
      architectures: [],
    };
    try {
      fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2), "utf8");
    } catch (e) {}
    return initialData;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.architectures)) {
      parsed.architectures = [];
    }
    return parsed;
  } catch (e) {
    return { activeId: null, architectures: [] };
  }
}

function saveStoredData(data) {
  const filePath = getFilePath();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
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
