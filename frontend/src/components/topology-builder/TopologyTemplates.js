/**
 * Template Arsitektur Topologi Jaringan Siap Pakai
 */

export const TOPOLOGY_TEMPLATES = [
  {
    id: "ftth-gpon",
    name: "Arsitektur FTTH GPON (OLT - ODC - ODP)",
    description: "Topologi distribusi fiber optic dari ISP Core ke OLT, ODC, ODP hingga Router Klien.",
    category: "FTTH / Fiber",
    nodes: [
      {
        id: "isp-cloud",
        type: "cloud",
        label: "Internet Gateway (ISP Uplink)",
        sublabel: "BGP / 10 Gbps FO",
        ip: "103.145.22.1",
        status: "online",
        x: 450,
        y: 80,
        vendor: "ISP Core",
        ports: "10G SFP+",
      },
      {
        id: "core-router",
        type: "router",
        label: "MikroTik CCR2116 Core",
        sublabel: "10.0.0.1 / Gateway Utama",
        ip: "10.0.0.1",
        status: "online",
        x: 450,
        y: 220,
        vendor: "Mikrotik",
        ports: "16x 10G SFP+",
      },
      {
        id: "hsgq-olt",
        type: "olt",
        label: "HSGQ OLT GPON 16-Port",
        sublabel: "10.0.10.2 / PON Core",
        ip: "10.0.10.2",
        status: "online",
        x: 450,
        y: 380,
        vendor: "HSGQ",
        ports: "16x PON + 4x 10G Uplink",
      },
      {
        id: "odc-01",
        type: "odc",
        label: "ODC-01 (Feeder Utama)",
        sublabel: "Splitter 1:4 / Tray A",
        ip: "Kapasitas 144 Core",
        status: "online",
        x: 250,
        y: 540,
        vendor: "Optical Cabinet",
        ports: "1:4 Splitter",
      },
      {
        id: "odc-02",
        type: "odc",
        label: "ODC-02 (Feeder Timur)",
        sublabel: "Splitter 1:4 / Tray B",
        ip: "Kapasitas 96 Core",
        status: "online",
        x: 650,
        y: 540,
        vendor: "Optical Cabinet",
        ports: "1:4 Splitter",
      },
      {
        id: "odp-01",
        type: "odp",
        label: "ODP-BL-01 (Kecamatan)",
        sublabel: "Splitter 1:8 / Port 1-8",
        ip: "Pole #12 - Baleendah",
        status: "online",
        x: 130,
        y: 700,
        vendor: "Outdoor Box",
        ports: "8 Dropcore",
      },
      {
        id: "odp-02",
        type: "odp",
        label: "ODP-BL-02 (Desa)",
        sublabel: "Splitter 1:8 / Port 1-8",
        ip: "Pole #15 - Malakasari",
        status: "online",
        x: 370,
        y: 700,
        vendor: "Outdoor Box",
        ports: "8 Dropcore",
      },
      {
        id: "odp-03",
        type: "odp",
        label: "ODP-SO-01 (OPD)",
        sublabel: "Splitter 1:8 / Port 1-8",
        ip: "Pole #22 - Soreang",
        status: "online",
        x: 550,
        y: 700,
        vendor: "Outdoor Box",
        ports: "8 Dropcore",
      },
      {
        id: "odp-04",
        type: "odp",
        label: "ODP-SO-02 (Klinik)",
        sublabel: "Splitter 1:8 / Port 1-8",
        ip: "Pole #28 - Padasuka",
        status: "offline",
        x: 770,
        y: 700,
        vendor: "Outdoor Box",
        ports: "8 Dropcore",
      },
      {
        id: "client-desa-1",
        type: "client",
        label: "Kantor Desa Baleendah",
        sublabel: "192.168.10.1 (PPPoE)",
        ip: "192.168.10.1",
        status: "online",
        x: 130,
        y: 860,
        vendor: "Ruijie Reyee",
        ports: "Gigabit WAN",
      },
      {
        id: "client-desa-2",
        type: "client",
        label: "Kantor Desa Malakasari",
        sublabel: "192.168.10.2 (PPPoE)",
        ip: "192.168.10.2",
        status: "online",
        x: 370,
        y: 860,
        vendor: "Ruijie Reyee",
        ports: "Gigabit WAN",
      },
      {
        id: "client-opd-1",
        type: "client",
        label: "Diskominfo Kab. Bandung",
        sublabel: "10.20.1.1 (L2TP Core)",
        ip: "10.20.1.1",
        status: "online",
        x: 550,
        y: 860,
        vendor: "Mikrotik hEX",
        ports: "Gigabit WAN",
      },
      {
        id: "client-opd-2",
        type: "client",
        label: "Puskesmas Padasuka",
        sublabel: "192.168.20.5 (PPPoE)",
        ip: "192.168.20.5",
        status: "offline",
        x: 770,
        y: 860,
        vendor: "Ruijie Reyee",
        ports: "Gigabit WAN",
      },
    ],
    links: [
      { id: "l-isp-core", from: "isp-cloud", to: "core-router", type: "fiber", label: "10 Gbps Uplink", status: "online", speed: 1.5 },
      { id: "l-core-olt", from: "core-router", to: "hsgq-olt", type: "fiber", label: "SFP+ Trunk 10G", status: "online", speed: 1.5 },
      { id: "l-olt-odc1", from: "hsgq-olt", to: "odc-01", type: "fiber", label: "PON 1-4 Feeder", status: "online", speed: 1.2 },
      { id: "l-olt-odc2", from: "hsgq-olt", to: "odc-02", type: "fiber", label: "PON 5-8 Feeder", status: "online", speed: 1.2 },
      { id: "l-odc1-odp1", from: "odc-01", to: "odp-01", type: "fiber", label: "Distribusi FO 24C", status: "online", speed: 1.0 },
      { id: "l-odc1-odp2", from: "odc-01", to: "odp-02", type: "fiber", label: "Distribusi FO 24C", status: "online", speed: 1.0 },
      { id: "l-odc2-odp3", from: "odc-02", to: "odp-03", type: "fiber", label: "Distribusi FO 24C", status: "online", speed: 1.0 },
      { id: "l-odc2-odp4", from: "odc-02", to: "odp-04", type: "fiber", label: "Distribusi FO 12C", status: "offline", speed: 0 },
      { id: "l-odp1-c1", from: "odp-01", to: "client-desa-1", type: "ethernet", label: "Dropcore 1C (100M)", status: "online", speed: 0.8 },
      { id: "l-odp2-c2", from: "odp-02", to: "client-desa-2", type: "ethernet", label: "Dropcore 1C (100M)", status: "online", speed: 0.8 },
      { id: "l-odp3-c3", from: "odp-03", to: "client-opd-1", type: "ethernet", label: "Dropcore 1C (1G)", status: "online", speed: 1.0 },
      { id: "l-odp4-c4", from: "odp-04", to: "client-opd-2", type: "ethernet", label: "Dropcore 1C (Putus)", status: "offline", speed: 0 },
    ],
  },
  {
    id: "hybrid-diskominfo",
    name: "Arsitektur Hybrid NOC Diskominfo (PPPoE OPD & L2TP Desa)",
    description: "Skema jaringan terpusat Diskominfo menghubungkan Server Database, Concentrator VPN, OPD, dan Desa.",
    category: "Pemerintah / Enterprise",
    nodes: [
      {
        id: "wan-gw",
        type: "cloud",
        label: "IP Transit / Telkom FO",
        sublabel: "Bandwidth 1 Gbps Dedicated",
        ip: "180.250.10.1",
        status: "online",
        x: 480,
        y: 60,
        vendor: "Telkom Astinet",
        ports: "1G SFP",
      },
      {
        id: "firewall-core",
        type: "firewall",
        label: "Edge Firewall FortiGate",
        sublabel: "10.10.0.1 / IPS & Anti-DDoS",
        ip: "10.10.0.1",
        status: "online",
        x: 480,
        y: 190,
        vendor: "Fortinet",
        ports: "8x GbE, 2x 10G",
      },
      {
        id: "core-switch",
        type: "switch",
        label: "Core Switch L3 Nexus",
        sublabel: "10.10.0.2 / VLAN Master",
        ip: "10.10.0.2",
        status: "online",
        x: 480,
        y: 330,
        vendor: "Cisco / Ruijie",
        ports: "24x 10G SFP+",
      },
      {
        id: "srv-db",
        type: "server",
        label: "Database & NOCR Server",
        sublabel: "10.10.50.10 / PostgreSQL",
        ip: "10.10.50.10",
        status: "online",
        x: 180,
        y: 470,
        vendor: "Dell PowerEdge",
        ports: "Dual 10G LACP",
      },
      {
        id: "router-opd",
        type: "router",
        label: "Router PPPoE OPD (MikroTik)",
        sublabel: "10.10.20.1 / OPD Concentrator",
        ip: "10.10.20.1",
        status: "online",
        x: 400,
        y: 470,
        vendor: "Mikrotik CCR1036",
        ports: "8x GbE, 2x SFP+",
      },
      {
        id: "router-desa",
        type: "router",
        label: "Router L2TP Desa (MikroTik)",
        sublabel: "10.10.30.1 / Desa Concentrator",
        ip: "10.10.30.1",
        status: "online",
        x: 650,
        y: 470,
        vendor: "Mikrotik CCR1036",
        ports: "8x GbE, 2x SFP+",
      },
      {
        id: "dist-sw-opd",
        type: "switch",
        label: "Dist Switch Gedung OPD",
        sublabel: "10.10.20.2 / PoE 24-Port",
        ip: "10.10.20.2",
        status: "online",
        x: 400,
        y: 620,
        vendor: "Ruijie Reyee",
        ports: "24x PoE Gigabit",
      },
      {
        id: "ap-setda",
        type: "ap",
        label: "Ruijie AP Setda Lantai 1",
        sublabel: "10.10.20.50 / Wi-Fi 6",
        ip: "10.10.20.50",
        status: "online",
        x: 280,
        y: 770,
        vendor: "Ruijie RG-RAP2260",
        ports: "Wi-Fi 6 AX3000",
      },
      {
        id: "pc-bapenda",
        type: "pc",
        label: "Workstation Bapenda",
        sublabel: "10.10.20.101 / VLAN 20",
        ip: "10.10.20.101",
        status: "online",
        x: 480,
        y: 770,
        vendor: "Client Workstation",
        ports: "1G RJ45",
      },
      {
        id: "desa-remote-1",
        type: "router",
        label: "Router Desa Soreang",
        sublabel: "10.10.30.12 (L2TP Tunnel)",
        ip: "10.10.30.12",
        status: "online",
        x: 650,
        y: 620,
        vendor: "Mikrotik RB750Gr3",
        ports: "5x GbE",
      },
      {
        id: "ap-desa-soreang",
        type: "ap",
        label: "Ruijie AP Balai Desa",
        sublabel: "192.168.88.2 / Hotspot Desa",
        ip: "192.168.88.2",
        status: "online",
        x: 650,
        y: 770,
        vendor: "Ruijie RG-RAP1200",
        ports: "Wi-Fi 5 AC1200",
      },
    ],
    links: [
      { id: "lh-1", from: "wan-gw", to: "firewall-core", type: "fiber", label: "Uplink Astinet", status: "online", speed: 1.5 },
      { id: "lh-2", from: "firewall-core", to: "core-switch", type: "fiber", label: "Trunk 10G LACP", status: "online", speed: 1.5 },
      { id: "lh-3", from: "core-switch", to: "srv-db", type: "ethernet", label: "Server Link 10G", status: "online", speed: 1.2 },
      { id: "lh-4", from: "core-switch", to: "router-opd", type: "fiber", label: "VLAN 20 PPPoE", status: "online", speed: 1.2 },
      { id: "lh-5", from: "core-switch", to: "router-desa", type: "fiber", label: "VLAN 30 L2TP", status: "online", speed: 1.2 },
      { id: "lh-6", from: "router-opd", to: "dist-sw-opd", type: "ethernet", label: "Trunk GbE", status: "online", speed: 1.0 },
      { id: "lh-7", from: "dist-sw-opd", to: "ap-setda", type: "ethernet", label: "PoE GbE (VLAN 20)", status: "online", speed: 0.9 },
      { id: "lh-8", from: "dist-sw-opd", to: "pc-bapenda", type: "ethernet", label: "LAN Cat6 (VLAN 20)", status: "online", speed: 0.8 },
      { id: "lh-9", from: "router-desa", to: "desa-remote-1", type: "vpn", label: "L2TP/IPSec Encrypted", status: "online", speed: 0.9 },
      { id: "lh-10", from: "desa-remote-1", to: "ap-desa-soreang", type: "ethernet", label: "PoE LAN Hotspot", status: "online", speed: 0.8 },
    ],
  },
  {
    id: "wireless-backhaul",
    name: "Arsitektur Wireless PTP & Tower Relay",
    description: "Jaringan wireless point-to-point menghubungkan Tower Pusat NOC ke Tower Relay Bukit dan Repeater Desa.",
    category: "Wireless / Radio",
    nodes: [
      {
        id: "noc-tower",
        type: "router",
        label: "NOC Tower Central (MikroTik)",
        sublabel: "10.50.0.1 / Master PTP",
        ip: "10.50.0.1",
        status: "online",
        x: 450,
        y: 80,
        vendor: "Mikrotik CCR2004",
        ports: "12x 10G SFP+",
      },
      {
        id: "radio-master",
        type: "wireless",
        label: "AirFiber 5XHD (Dish 30dBi)",
        sublabel: "5.8 GHz / 500 Mbps PTP",
        ip: "10.50.0.10",
        status: "online",
        x: 450,
        y: 230,
        vendor: "Ubiquiti AirFiber",
        ports: "Gigabit PoE",
      },
      {
        id: "tower-relay",
        type: "wireless",
        label: "Tower Relay Bukit Soreang",
        sublabel: "Dish 30dBi Rx / 10.50.0.11",
        ip: "10.50.0.11",
        status: "online",
        x: 450,
        y: 400,
        vendor: "Ubiquiti AirFiber",
        ports: "Gigabit PoE",
      },
      {
        id: "sw-relay",
        type: "switch",
        label: "NetPower Switch Tower",
        sublabel: "10.50.0.12 / Outdoor PoE",
        ip: "10.50.0.12",
        status: "online",
        x: 450,
        y: 550,
        vendor: "Mikrotik netPower",
        ports: "16x GbE PoE",
      },
      {
        id: "sector-desa-a",
        type: "wireless",
        label: "Sektor Radio Desa Rancamanyar",
        sublabel: "Sector 120 deg / PtMP",
        ip: "10.50.1.1",
        status: "online",
        x: 250,
        y: 700,
        vendor: "Mikrotik mANTBox",
        ports: "Gigabit PoE",
      },
      {
        id: "sector-desa-b",
        type: "wireless",
        label: "Sektor Radio Desa Bojongsoang",
        sublabel: "Sector 120 deg / PtMP",
        ip: "10.50.2.1",
        status: "online",
        x: 650,
        y: 700,
        vendor: "Mikrotik mANTBox",
        ports: "Gigabit PoE",
      },
      {
        id: "cpe-desa-a",
        type: "client",
        label: "CPE Kantor Desa Rancamanyar",
        sublabel: "192.168.100.1 / Disc Lite5",
        ip: "192.168.100.1",
        status: "online",
        x: 250,
        y: 860,
        vendor: "Mikrotik DISC Lite5",
        ports: "100M PoE",
      },
      {
        id: "cpe-desa-b",
        type: "client",
        label: "CPE Kantor Desa Bojongsoang",
        sublabel: "192.168.200.1 / SXTsq 5",
        ip: "192.168.200.1",
        status: "online",
        x: 650,
        y: 860,
        vendor: "Mikrotik SXTsq",
        ports: "100M PoE",
      },
    ],
    links: [
      { id: "lw-1", from: "noc-tower", to: "radio-master", type: "ethernet", label: "PoE Uplink", status: "online", speed: 1.2 },
      { id: "lw-2", from: "radio-master", to: "tower-relay", type: "wireless", label: "Wireless PTP 5.8GHz (15 Km)", status: "online", speed: 1.5 },
      { id: "lw-3", from: "tower-relay", to: "sw-relay", type: "ethernet", label: "Gigabit PoE", status: "online", speed: 1.2 },
      { id: "lw-4", from: "sw-relay", to: "sector-desa-a", type: "ethernet", label: "Sector A Feeder", status: "online", speed: 1.0 },
      { id: "lw-5", from: "sw-relay", to: "sector-desa-b", type: "ethernet", label: "Sector B Feeder", status: "online", speed: 1.0 },
      { id: "lw-6", from: "sector-desa-a", to: "cpe-desa-a", type: "wireless", label: "Wireless PtMP (4.2 Km)", status: "online", speed: 0.8 },
      { id: "lw-7", from: "sector-desa-b", to: "cpe-desa-b", type: "wireless", label: "Wireless PtMP (6.8 Km)", status: "online", speed: 0.8 },
    ],
  },
];

/**
 * Menghitung status efektif node berdasarkan dependensi hierarki top-down
 * Aturan:
 * 1. Node Root / Independent ('cloud', 'isp', 'vpn', 'vpn_gateway'):
 *    - Statusnya independen (tidak mati jika downstream atau router mati).
 *    - Khusus 'vpn' (VPN Tunneling): selalu independen dari status MikroTik. Jika MikroTik mati,
 *      VPN tetap hidup, tetapi kabel VPN <-> MikroTik mati.
 * 2. Node Downstream / Dependent (Router, OLT, ODC, ODP, ONT/Modem, AP/Client):
 *    - Untuk hidup (online), node harus memiliki status raw "online"
 *      DAN harus memiliki minimal satu jalur aktif (online) dari upstream parent yang terhubung.
 *    - Jika upstream parent mati, maka seluruh aliran ke bawah ikut mati (cascading outage).
 * 3. Node yang tidak memiliki incoming/upstream link sama sekali (standalone):
 *    - Status efektif = status raw node itu sendiri.
 */
export function computeCascadedNodes(rawNodes, rawLinks) {
  if (!Array.isArray(rawNodes) || rawNodes.length === 0) return [];
  if (!Array.isArray(rawLinks) || rawLinks.length === 0) return rawNodes;

  const nodeMap = new Map();
  rawNodes.forEach((n) => nodeMap.set(n.id, { ...n }));

  // Tingkat hierarki (semakin tinggi rank, semakin dekat ke hulu/internet)
  const HIERARCHY_RANKS = {
    cloud: 100,
    isp: 100,
    internet: 100,
    vpn: 90,
    vpn_gateway: 90,
    router: 80,
    firewall: 80,
    server: 75,
    olt: 70,
    switch: 65,
    odc: 60,
    odp: 50,
    splitter: 45,
    closure: 45,
    ont: 30,
    modem: 30,
    client: 20,
    ap: 10,
    ruijie: 10,
    wireless: 10,
    pc: 5,
    laptop: 5,
  };

  const getNodeRank = (node) => {
    const type = (node?.type || "").toLowerCase();
    const vendor = (node?.vendor || "").toLowerCase();
    if (type === "vpn" || vendor.includes("vpn")) return 90;
    if (type === "cloud" || type === "isp" || vendor.includes("isp")) return 100;
    if (type === "olt" || vendor.includes("hsgq") || vendor.includes("olt")) return 70;
    if (type === "odc" || vendor.includes("odc")) return 60;
    if (type === "odp" || vendor.includes("odp")) return 50;
    if (type === "ont" || vendor.includes("modem") || vendor.includes("ont")) return 30;
    if (type === "ap" || vendor.includes("ruijie") || vendor.includes("ap")) return 10;
    return HIERARCHY_RANKS[type] || 50;
  };

  const isIndependentRoot = (node) => {
    const type = (node?.type || "").toLowerCase();
    const vendor = (node?.vendor || "").toLowerCase();
    return (
      type === "cloud" ||
      type === "isp" ||
      type === "internet" ||
      type === "vpn" ||
      type === "vpn_gateway" ||
      vendor.includes("vpn") ||
      vendor.includes("isp")
    );
  };

  // Buat adjacency list graf dependensi (parent -> child)
  const parentsMap = new Map();

  rawNodes.forEach((n) => {
    parentsMap.set(n.id, []);
  });

  rawLinks.forEach((link) => {
    const nodeA = nodeMap.get(link.from);
    const nodeB = nodeMap.get(link.to);
    if (!nodeA || !nodeB) return;

    // Kecualikan relasi jika salah satunya adalah VPN (karena VPN adalah endpoint independen)
    const isNodeAVPN = (nodeA.type || "").toLowerCase() === "vpn";
    const isNodeBVPN = (nodeB.type || "").toLowerCase() === "vpn";

    if (isNodeAVPN || isNodeBVPN) {
      // Hubungan link peer / service link, tidak mematikan satu sama lain
      return;
    }

    const rankA = getNodeRank(nodeA);
    const rankB = getNodeRank(nodeB);

    let parentId, childId;

    if (rankA !== rankB) {
      parentId = rankA > rankB ? nodeA.id : nodeB.id;
      childId = rankA > rankB ? nodeB.id : nodeA.id;
    } else {
      // Jika rank sama, yang posisinya lebih atas di layar adalah parent
      parentId = nodeA.y <= nodeB.y ? nodeA.id : nodeB.id;
      childId = nodeA.y <= nodeB.y ? nodeB.id : nodeA.id;
    }

    parentsMap.get(childId)?.push(parentId);
  });

  // Evaluasi status efektif
  const effectiveStatus = new Map();

  // 1. Tentukan status awal untuk independent roots & standalone nodes
  rawNodes.forEach((n) => {
    const parents = parentsMap.get(n.id) || [];
    if (isIndependentRoot(n) || parents.length === 0) {
      effectiveStatus.set(n.id, n.status === "online" ? "online" : "offline");
    }
  });

  // 2. Propagasi bertahap (iterative resolution) untuk dependent nodes
  let changed = true;
  let iterations = 0;
  while (changed && iterations < rawNodes.length + 2) {
    changed = false;
    iterations++;

    rawNodes.forEach((n) => {
      if (effectiveStatus.has(n.id) && isIndependentRoot(n)) return;

      const parents = parentsMap.get(n.id) || [];
      if (parents.length === 0) {
        if (!effectiveStatus.has(n.id)) {
          effectiveStatus.set(n.id, n.status === "online" ? "online" : "offline");
          changed = true;
        }
        return;
      }

      // Node downstream: hanya online jika dirinya sendiri raw online DAN minimal ada 1 parent yang online
      const selfRawOnline = n.status === "online";
      const hasActiveParent = parents.some((pId) => effectiveStatus.get(pId) === "online");

      const nextStatus = (selfRawOnline && hasActiveParent) ? "online" : "offline";
      if (effectiveStatus.get(n.id) !== nextStatus) {
        effectiveStatus.set(n.id, nextStatus);
        changed = true;
      }
    });
  }

  // Rakit kembali array node dengan status efektif
  return rawNodes.map((n) => ({
    ...n,
    raw_status: n.status,
    status: effectiveStatus.get(n.id) || n.status || "offline",
  }));
}
