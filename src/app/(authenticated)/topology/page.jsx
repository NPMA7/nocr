"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import axios from "axios";
import {
  GitGraph,
  MapPin,
  Sparkles,
  Save,
  Download,
  Upload,
  RotateCcw,
  RotateCw,
  Trash2,
  Layers,
  FolderOpen,
  Image as ImageIcon,
  Check,
  Zap,
  Plus,
  Play,
  Pause,
  Share2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Sliders,
  Flame,
  Star,
  RefreshCw,
  BookmarkCheck,
  Search,
  X,
  Box,
  Maximize2,
} from "lucide-react";
import { toPng } from "html-to-image";

import TopologyCanvas from "@/components/topology-builder/TopologyCanvas";
import { maskIpAddress } from "@/components/topology-builder/NodeCard";
import DevicePalette, { matchHardwareType, isSameSite, computeNocrAggregates } from "@/components/topology-builder/DevicePalette";
import PropertiesDrawer from "@/components/topology-builder/PropertiesDrawer";
import SimulationControl from "@/components/topology-builder/SimulationControl";
import { TOPOLOGY_TEMPLATES, computeCascadedNodes } from "@/components/topology-builder/TopologyTemplates";
import { AREA_THEMES } from "@/components/topology-builder/AreaBox";
import { API_URL, socket, useAppState } from "@/App";
import { hasAccess, getStoredUser, normalizeRole, isSuperAdmin } from "@/lib/roles";
import { ShieldAlert } from "lucide-react";

export default function TopologyArchitecturePage() {
  const { showToast } = useAppState();

  // Role permissions
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [perms, setPerms] = useState(() => {
    const user = getStoredUser();
    const isSuper = isSuperAdmin(user);
    return {
      canRead: isSuper || hasAccess(user, "topology", "read"),
      canCreate: isSuper || hasAccess(user, "topology", "create"),
      canUpdate: isSuper || hasAccess(user, "topology", "update"),
      canDelete: isSuper || hasAccess(user, "topology", "delete"),
    };
  });

  const syncPerms = () => {
    const user = getStoredUser();
    setCurrentUser(user);
    const isSuper = isSuperAdmin(user);
    setPerms({
      canRead: isSuper || hasAccess(user, "topology", "read"),
      canCreate: isSuper || hasAccess(user, "topology", "create"),
      canUpdate: isSuper || hasAccess(user, "topology", "update"),
      canDelete: isSuper || hasAccess(user, "topology", "delete"),
    });
  };

  useEffect(() => {
    syncPerms();
    const onRoleUpdate = () => syncPerms();
    window.addEventListener("nocr-role-updated", onRoleUpdate);
    return () => window.removeEventListener("nocr-role-updated", onRoleUpdate);
  }, []);

  // Topology Data State - Starts Clean
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [areas, setAreas] = useState([]);
  const [activeTemplateName, setActiveTemplateName] = useState("Skema Baru");
  const [savedDiagrams, setSavedDiagrams] = useState([]);
  const [defaultTemplateId, setDefaultTemplateId] = useState(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const isInitialLoadDone = useRef(false);

  // Selection State
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedLinkId, setSelectedLinkId] = useState(null);

  // UI Panels State
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveDesc, setSaveDesc] = useState("");

  // Canvas Settings State
  const [gridStyle, setGridStyle] = useState("dots"); // 'dots' | 'lines' | 'none'
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [simulationActive, setSimulationActive] = useState(true);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [showLabels, setShowLabels] = useState(true);

  // Live devices & Live Mappings (Desa & OPD from database)
  const [liveMappings, setLiveMappings] = useState([]);
  const [liveDevices, setLiveDevices] = useState([]);

  // History Stack for Undo/Redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isHistoryAction = useRef(false);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const linksRef = useRef(links);
  linksRef.current = links;
  const areasRef = useRef(areas);
  areasRef.current = areas;
  const historyRef = useRef(history);
  historyRef.current = history;
  const historyIndexRef = useRef(historyIndex);
  historyIndexRef.current = historyIndex;

  const canvasExportRef = useRef(null);
  const fileInputRef = useRef(null);

  // Push to history on state change
  const pushState = useCallback((newNodes, newLinks, newAreas) => {
    if (isHistoryAction.current) {
      isHistoryAction.current = false;
      return;
    }
    const currentNodes = newNodes !== undefined ? newNodes : nodesRef.current;
    const currentLinks = newLinks !== undefined ? newLinks : linksRef.current;
    const currentAreas = newAreas !== undefined ? newAreas : areasRef.current;

    const currIdx = historyIndexRef.current;
    const currHist = historyRef.current;
    const slice = currHist.slice(0, currIdx + 1);

    const nextEntry = {
      nodes: JSON.parse(JSON.stringify(currentNodes)),
      links: JSON.parse(JSON.stringify(currentLinks)),
      areas: JSON.parse(JSON.stringify(currentAreas)),
    };

    const nextHist = [...slice, nextEntry];
    if (nextHist.length > 50) nextHist.shift();

    setHistory(nextHist);
    setHistoryIndex(nextHist.length - 1);
  }, []);

  // Search & Focus Target State (for jumping to area boxes / nodes)
  const [focusTarget, setFocusTarget] = useState(null); // { type: 'area'|'node', id: string, timestamp: number }
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef(null);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut '/' to open search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === "/" &&
        document.activeElement.tagName !== "INPUT" &&
        document.activeElement.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        setIsSearchOpen(true);
        const input = searchRef.current?.querySelector("input");
        if (input) input.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Hitung status efektif dengan propagasi gangguan (cascading outage) + Live Aggregates Real-Time
  const effectiveNodes = useMemo(() => {
    const aggregates = (liveMappings && liveMappings.length > 0) ? computeNocrAggregates(liveMappings) : null;

    // 1. Inject live aggregate counts directly from DB
    const withLiveAggregates = (nodes || []).map((node) => {
      if (!node.is_aggregate) return node;
      if (!aggregates) return node;

      // Smart resolution of aggregate key
      let aggKey = node.aggregate_type;
      if (!aggKey || !aggregates[aggKey]) {
        const lbl = (node.label || "").toLowerCase();
        const sub = (node.sublabel || "").toLowerCase();
        const ven = (node.vendor || "").toLowerCase();
        const cat = (node.nocr_category || "").toLowerCase();
        if (cat === "opd" || lbl.includes("opd") || sub.includes("opd") || ven.includes("opd")) {
          if (node.type === "ap" || lbl.includes("ruijie") || ven.includes("ruijie")) aggKey = "opd_ruijie";
          else aggKey = "opd_ont";
        } else {
          if (node.type === "ap" || lbl.includes("ruijie") || ven.includes("ruijie")) aggKey = "desa_ruijie";
          else if (node.type === "router" || lbl.includes("mikrotik") || ven.includes("mikrotik")) aggKey = "desa_mikrotik";
          else aggKey = "desa_ont";
        }
      }

      const aggData = aggregates[aggKey];
      if (aggData) {
        return {
          ...node,
          is_aggregate: true,
          aggregate_type: aggKey,
          status: aggData.online > 0 ? "online" : "offline",
          total_count: aggData.total,
          online_count: aggData.online,
          offline_count: aggData.offline,
          sublabel: `${aggData.total} Unit • ${aggData.online} Online • ${aggData.offline} Offline`,
        };
      }
      return node;
    });

    // 2. Compute cascading link outage propagation
    return computeCascadedNodes(withLiveAggregates, links);
  }, [nodes, links, liveMappings]);

  // Filtered Area Boxes & Nodes for search
  const filteredAreas = (areas || []).filter((a) =>
    (a.name || "").toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const filteredNodes = (effectiveNodes || []).filter((n) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return false;
    return (
      (n.label || "").toLowerCase().includes(q) ||
      (n.ip || "").includes(q) ||
      (n.sublabel || "").toLowerCase().includes(q) ||
      (n.vendor || "").toLowerCase().includes(q) ||
      (n.nocr_hw_type || "").toLowerCase().includes(q) ||
      (n.type || "").toLowerCase().includes(q)
    );
  });

  const handleSelectAreaFromSearch = (area) => {
    setFocusTarget({ type: "area", id: area.id, timestamp: Date.now() });
    setIsSearchOpen(false);
    showToast?.(`📍 Lompat ke Kotak Area "${area.name}"`, "info");
  };

  const handleSelectNodeFromSearch = (node) => {
    setFocusTarget({ type: "node", id: node.id, timestamp: Date.now() });
    setIsSearchOpen(false);
    setSelectedNodeId(node.id);
  };

  // Load Saved Architectures from API & LocalStorage and restore startup template
  const fetchArchitectures = async () => {
    let list = [];
    let defaultId = null;

    try {
      const res = await axios.get("/api/topology/architecture");
      if (res.data?.architectures && Array.isArray(res.data.architectures)) {
        list = res.data.architectures;
        defaultId = res.data.defaultId || null;
        setSavedDiagrams(list);
        setDefaultTemplateId(defaultId);
        try {
          localStorage.setItem("nocr_saved_topology_templates", JSON.stringify(list));
          if (defaultId) {
            localStorage.setItem("nocr_default_topology_id", defaultId);
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn("Menggunakan cache lokal template:", e);
    }

    if (list.length === 0) {
      try {
        const cached = localStorage.getItem("nocr_saved_topology_templates");
        if (cached) {
          list = JSON.parse(cached);
          setSavedDiagrams(list);
        }
      } catch (e) {}
    }

    if (!defaultId) {
      try {
        defaultId = localStorage.getItem("nocr_default_topology_id");
        if (defaultId) setDefaultTemplateId(defaultId);
      } catch (e) {}
    }

    // If first startup/mount:
    if (!isInitialLoadDone.current) {
      isInitialLoadDone.current = true;

      // 1. Try to load default template if configured
      let templateToLoad = null;
      if (defaultId) {
        templateToLoad = list.find((d) => d.id === defaultId);
      }
      if (!templateToLoad) {
        templateToLoad = list.find((d) => d.is_default);
      }

      // For read-only users without a designated default, fallback to the latest saved template
      if (!templateToLoad && (!perms.canUpdate && !perms.canCreate) && list.length > 0) {
        templateToLoad = list[0];
      }

      // 2. If default template found, load it immediately!
      if (templateToLoad) {
        setNodes(templateToLoad.nodes || []);
        setLinks(templateToLoad.links || []);
        setAreas(templateToLoad.areas || []);
        setActiveTemplateName(templateToLoad.name || "Skema Topologi");
        setHistory([{ nodes: templateToLoad.nodes || [], links: templateToLoad.links || [], areas: templateToLoad.areas || [] }]);
        setHistoryIndex(0);
        return;
      }

      // 3. If no default template, check if there is an unsaved session cache (for editors)
      try {
        const sessionState = localStorage.getItem("nocr_active_canvas_session");
        if (sessionState) {
          const parsed = JSON.parse(sessionState);
          if (Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
            setNodes(parsed.nodes);
            setLinks(parsed.links || []);
            setAreas(parsed.areas || []);
            setActiveTemplateName(parsed.title || "Skema Topologi");
            setHistory([{ nodes: parsed.nodes, links: parsed.links || [], areas: parsed.areas || [] }]);
            setHistoryIndex(0);
            return;
          }
        }
      } catch (e) {}
    }
  };

  // Calculate dynamic live status based on NOCR hardware type & category
  const calculateNodeLiveStatus = (node, mapping) => {
    if (!mapping) return node.status || "offline";

    const isOPD =
      mapping.connection_type === "PPPOE" ||
      node.nocr_category === "opd" ||
      (mapping.prefix && mapping.prefix.toUpperCase().includes("OPD")) ||
      (mapping.prefix && mapping.prefix.toUpperCase().includes("DISKOMINFO"));

    const hwType = (
      node.nocr_hw_type ||
      (node.vendor?.toLowerCase().includes("ruijie")
        ? "ruijie"
        : node.vendor?.toLowerCase().includes("modem") || node.type === "ont"
        ? "ont"
        : node.type) ||
      ""
    ).toLowerCase();

    // Check status values from database: UP / Online / Connected -> online
    const isRuijieUp =
      (mapping.status_ruijie || "").toLowerCase() === "up" ||
      (mapping.status_ruijie || "").toLowerCase() === "online";

    const isMikrotikUp =
      (mapping.status_mikrotik || "").toLowerCase() === "up" ||
      (mapping.status_mikrotik || "").toLowerCase() === "online";

    const isFinalUp =
      (mapping.final_status || "").toLowerCase() === "online" ||
      (mapping.final_status || "").toLowerCase() === "up";

    if (hwType === "ruijie" || hwType === "ap" || node.type === "ap" || node.type === "ruijie") {
      return isRuijieUp ? "online" : "offline";
    }

    if (hwType === "mikrotik" || hwType === "router" || node.type === "router" || node.type === "mikrotik") {
      return isMikrotikUp ? "online" : "offline";
    }

    if (hwType === "ont" || hwType === "modem" || hwType === "client" || node.type === "ont" || node.type === "client") {
      if (isOPD) {
        return isMikrotikUp ? "online" : "offline";
      }
      return isFinalUp || isMikrotikUp ? "online" : "offline";
    }

    return isMikrotikUp || isFinalUp || isRuijieUp ? "online" : (node.status || "offline");
  };

  // Live Auto-Sync: Periodically check mappings
  const fetchLiveMappings = useCallback(async () => {
    try {
      const res = await axios.get("/api/mappings?force=true");
      const list = Array.isArray(res.data) ? res.data : (res.data?.mappings || []);
      if (list && Array.isArray(list) && list.length > 0) {
        setLiveMappings(list);

        const aggregates = computeNocrAggregates(list);

        // Auto update node status based on fresh DB data (both aggregate & regular nodes)
        setNodes((prevNodes) =>
          prevNodes.map((node) => {
            if (node.is_aggregate) {
              let aggKey = node.aggregate_type;
              if (!aggKey || !aggregates[aggKey]) {
                const lbl = (node.label || "").toLowerCase();
                const sub = (node.sublabel || "").toLowerCase();
                const ven = (node.vendor || "").toLowerCase();
                const cat = (node.nocr_category || "").toLowerCase();
                if (cat === "opd" || lbl.includes("opd") || sub.includes("opd") || ven.includes("opd")) {
                  if (node.type === "ap" || lbl.includes("ruijie") || ven.includes("ruijie")) aggKey = "opd_ruijie";
                  else aggKey = "opd_ont";
                } else {
                  if (node.type === "ap" || lbl.includes("ruijie") || ven.includes("ruijie")) aggKey = "desa_ruijie";
                  else if (node.type === "router" || lbl.includes("mikrotik") || ven.includes("mikrotik")) aggKey = "desa_mikrotik";
                  else aggKey = "desa_ont";
                }
              }

              const aggData = aggregates[aggKey];
              if (aggData) {
                return {
                  ...node,
                  aggregate_type: aggKey,
                  status: aggData.online > 0 ? "online" : "offline",
                  total_count: aggData.total,
                  online_count: aggData.online,
                  offline_count: aggData.offline,
                  sublabel: `${aggData.total} Unit • ${aggData.online} Online • ${aggData.offline} Offline`,
                };
              }
              return node;
            }

            const match = list.find(
              (m) =>
                (node.mapping_prefix && m.prefix && node.mapping_prefix.trim().toLowerCase() === m.prefix.trim().toLowerCase()) ||
                (node.mapping_mac && m.ruijie_mac && node.mapping_mac.trim().toLowerCase().replace(/[^a-f0-9]/g, "") === m.ruijie_mac.trim().toLowerCase().replace(/[^a-f0-9]/g, "")) ||
                (node.ip && m.ip && node.ip.trim() === m.ip.trim()) ||
                (node.label && m.prefix && node.label.trim().toLowerCase() === m.prefix.trim().toLowerCase()) ||
                (node.label && m.site_name && node.label.trim().toLowerCase() === m.site_name.trim().toLowerCase()) ||
                (node.label && m.site_name && (node.label.trim().toLowerCase().includes(m.site_name.trim().toLowerCase()) || m.site_name.trim().toLowerCase().includes(node.label.trim().toLowerCase())))
            );

            if (match) {
              const liveStatus = calculateNodeLiveStatus(node, match);
              return {
                ...node,
                status: liveStatus,
                mapping_prefix: match.prefix || node.mapping_prefix,
                mapping_mac: match.ruijie_mac || node.mapping_mac,
                status_source: match.connection_type === "PPPOE" || node.nocr_category === "opd" ? "mikrotik" : "ruijie",
              };
            }
            return node;
          })
        );
      }
    } catch (e) {
      console.warn("fetchLiveMappings warning:", e);
    }
  }, []);

  const fetchLiveDevices = useCallback(async () => {
    try {
      const res = await axios.get("/api/devices");
      if (res.data && Array.isArray(res.data)) {
        setLiveDevices(res.data);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchArchitectures();
    fetchLiveMappings();
    fetchLiveDevices();
    // Inisialisasi history awal (kanvas kosong)
    setHistory([{ nodes: [], links: [], areas: [] }]);
    setHistoryIndex(0);

    // Ultra-fast live polling fallback every 2 seconds
    const pollInterval = setInterval(() => {
      fetchLiveMappings();
    }, 2000);

    if (socket) {
      const handleLiveUpdate = () => {
        fetchLiveMappings();
      };
      const handleArchUpdate = (data) => {
        if (data?.architectures && Array.isArray(data.architectures)) {
          setSavedDiagrams(data.architectures);
          setDefaultTemplateId(data.defaultId || null);
          try {
            localStorage.setItem("nocr_saved_topology_templates", JSON.stringify(data.architectures));
            if (data.defaultId) {
              localStorage.setItem("nocr_default_topology_id", data.defaultId);
            }
          } catch (e) {}

          // Jika user adalah Read-Only, auto sync kanvas ke template default terbaru
          if (!perms.canCreate && !perms.canUpdate) {
            let tpl = data.architectures.find((d) => d.id === data.defaultId) ||
                      data.architectures.find((d) => d.is_default) ||
                      data.architectures[0];
            if (tpl) {
              setNodes(tpl.nodes || []);
              setLinks(tpl.links || []);
              setAreas(tpl.areas || []);
              setActiveTemplateName(tpl.name || "Skema Topologi");
              setHistory([{ nodes: tpl.nodes || [], links: tpl.links || [], areas: tpl.areas || [] }]);
              setHistoryIndex(0);
            }
          }
        }
      };

      socket.on("topology_architecture_updated", handleArchUpdate);
      socket.on("mappings_updated", handleLiveUpdate);
      socket.on("mappings-updated", handleLiveUpdate);
      socket.on("device-status", handleLiveUpdate);
      socket.on("device_status_updated", handleLiveUpdate);
      socket.on("ruijie_sync_completed", handleLiveUpdate);
      socket.on("mikrotik_sync_completed", handleLiveUpdate);

      return () => {
        clearInterval(pollInterval);
        socket.off("topology_architecture_updated", handleArchUpdate);
        socket.off("mappings_updated", handleLiveUpdate);
        socket.off("mappings-updated", handleLiveUpdate);
        socket.off("device-status", handleLiveUpdate);
        socket.off("device_status_updated", handleLiveUpdate);
        socket.off("ruijie_sync_completed", handleLiveUpdate);
        socket.off("mikrotik_sync_completed", handleLiveUpdate);
      };
    }

    return () => clearInterval(pollInterval);
  }, [perms.canCreate, perms.canUpdate, fetchLiveMappings]);

  // Update nodes with history recording
  const handleSetNodes = (updater) => {
    setNodes((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      pushState(next, links, areas);
      return next;
    });
  };

  // Update links with history recording
  const handleSetLinks = (updater) => {
    setLinks((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      pushState(nodes, next, areas);
      return next;
    });
  };

  const handleNodeDragEnd = () => {
    pushState(nodes, links, areas);
  };

  // Undo (Ctrl+Z)
  const handleUndo = useCallback(() => {
    const currIdx = historyIndexRef.current;
    const currHist = historyRef.current;
    if (currIdx > 0) {
      isHistoryAction.current = true;
      const targetState = currHist[currIdx - 1];
      if (targetState) {
        setNodes(JSON.parse(JSON.stringify(targetState.nodes || [])));
        setLinks(JSON.parse(JSON.stringify(targetState.links || [])));
        setAreas(JSON.parse(JSON.stringify(targetState.areas || [])));
        setHistoryIndex(currIdx - 1);
        showToast?.("Undo berhasil (Ctrl+Z)", "info");
      }
    }
  }, [showToast]);

  // Redo (Ctrl+Y)
  const handleRedo = useCallback(() => {
    const currIdx = historyIndexRef.current;
    const currHist = historyRef.current;
    if (currIdx < currHist.length - 1) {
      isHistoryAction.current = true;
      const targetState = currHist[currIdx + 1];
      if (targetState) {
        setNodes(JSON.parse(JSON.stringify(targetState.nodes || [])));
        setLinks(JSON.parse(JSON.stringify(targetState.links || [])));
        setAreas(JSON.parse(JSON.stringify(targetState.areas || [])));
        setHistoryIndex(currIdx + 1);
        showToast?.("Redo berhasil (Ctrl+Y)", "info");
      }
    }
  }, [showToast]);

  // Global Keyboard Shortcuts (Ctrl+Z / Ctrl+Y / Undo / Redo / Search '/')
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput =
        document.activeElement.tagName === "INPUT" ||
        document.activeElement.tagName === "TEXTAREA" ||
        document.activeElement.isContentEditable;

      // 1. Search shortcut '/'
      if (e.key === "/" && !isInput) {
        e.preventDefault();
        setIsSearchOpen(true);
        const input = searchRef.current?.querySelector("input");
        if (input) input.focus();
        return;
      }

      // 2. Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
        if (!isInput) {
          e.preventDefault();
          handleUndo();
        }
        return;
      }

      // 3. Redo: Ctrl+Y / Cmd+Y / Ctrl+Shift+Z / Cmd+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "z" || e.key === "Z"))
      ) {
        if (!isInput) {
          e.preventDefault();
          handleRedo();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Selected Items
  const selectedNode = effectiveNodes.find((n) => n.id === selectedNodeId) || null;
  const selectedLink = links.find((l) => l.id === selectedLinkId) || null;

  // Node Selection Handlers
  const handleSelectNode = (node) => {
    setSelectedNodeId(node.id);
    setSelectedLinkId(null);
    if (perms.canCreate || perms.canUpdate) {
      setIsPropertiesOpen(true);
    }
  };

  const handleSelectLink = (link) => {
    setSelectedLinkId(link.id);
    setSelectedNodeId(null);
    if (perms.canCreate || perms.canUpdate) {
      setIsPropertiesOpen(true);
    }
  };

  const handleDeselectAll = () => {
    setSelectedNodeId(null);
    setSelectedLinkId(null);
  };

  // Update specific node
  const handleUpdateNode = (id, updates) => {
    handleSetNodes((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          const updated = { ...n, ...updates };
          if ((updates.nocr_hw_type || updates.type) && (n.mapping_prefix || n.mapping_mac)) {
            const matching = liveMappings.find(
              (m) =>
                (n.mapping_prefix && m.prefix && n.mapping_prefix.toLowerCase() === m.prefix.toLowerCase()) ||
                (n.mapping_mac && m.ruijie_mac && n.mapping_mac.toLowerCase() === m.ruijie_mac.toLowerCase()) ||
                (n.label && m.prefix && n.label.toLowerCase().includes(m.prefix.toLowerCase())) ||
                (n.label && m.site_name && n.label.toLowerCase().includes(m.site_name.toLowerCase()))
            );
            if (matching) {
              updated.status = calculateNodeLiveStatus(updated, matching);
            }
          }
          return updated;
        }
        return n;
      })
    );
  };

  // Update specific link
  const handleUpdateLink = (id, updates) => {
    handleSetLinks((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
    );
  };

  // Toggle single node status (Online <-> Offline)
  const handleToggleNodeStatus = (nodeId) => {
    handleSetNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          const nextStatus = n.status === "online" ? "offline" : "online";
          showToast?.(
            `Node ${n.label} diubah menjadi ${
              nextStatus === "online" ? "🟢 MENYALA (Online)" : "🔴 MATI (Offline)"
            }`,
            nextStatus === "online" ? "success" : "warning"
          );
          return { ...n, status: nextStatus };
        }
        return n;
      })
    );
  };

  // Delete Node
  const handleDeleteNode = (id) => {
    handleSetNodes((prev) => prev.filter((n) => n.id !== id));
    handleSetLinks((prev) => prev.filter((l) => l.from !== id && l.to !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
    showToast?.("Node berhasil dihapus", "info");
  };

  // Delete Link
  const handleDeleteLink = (id) => {
    handleSetLinks((prev) => prev.filter((l) => l.id !== id));
    if (selectedLinkId === id) setSelectedLinkId(null);
    showToast?.("Kabel jalur berhasil dihapus", "info");
  };

  // Duplicate Node
  const handleDuplicateNode = (node) => {
    const dup = {
      ...node,
      id: `node-${Date.now()}`,
      label: `${node.label} (Salinan)`,
      x: node.x + 40,
      y: node.y + 40,
    };
    handleSetNodes((prev) => [...prev, dup]);
    setSelectedNodeId(dup.id);
    showToast?.("Node diduplikasi", "success");
  };

  // Auto-save active canvas state to localStorage so refresh/restart never clears canvas
  useEffect(() => {
    if (!isInitialLoadDone.current) return;
    try {
      localStorage.setItem(
        "nocr_active_canvas_session",
        JSON.stringify({
          title: activeTemplateName,
          nodes,
          links,
          areas,
          savedAt: new Date().toISOString(),
        })
      );
    } catch (e) {}
  }, [nodes, links, areas, activeTemplateName]);

  // New Canvas Handler
  const handleNewCanvas = () => {
    setNodes([]);
    setLinks([]);
    setAreas([]);
    setSelectedNodeId(null);
    setSelectedLinkId(null);
    setActiveTemplateName("Skema Baru");
    pushState([], [], []);
    try {
      localStorage.setItem(
        "nocr_active_canvas_session",
        JSON.stringify({ title: "Skema Baru", nodes: [], links: [], areas: [] })
      );
    } catch (e) {}
    showToast?.("Kanvas baru kosong siap digunakan!", "info");
  };

  // Load Saved Schema / Template
  const handleLoadTemplate = (tpl) => {
    setNodes(tpl.nodes || []);
    setLinks(tpl.links || []);
    setAreas(tpl.areas || []);
    setActiveTemplateName(tpl.name || "Skema Topologi");
    setSelectedNodeId(null);
    setSelectedLinkId(null);
    setShowTemplateModal(false);
    pushState(tpl.nodes || [], tpl.links || [], tpl.areas || []);
    try {
      localStorage.setItem(
        "nocr_active_canvas_session",
        JSON.stringify({ title: tpl.name, nodes: tpl.nodes || [], links: tpl.links || [], areas: tpl.areas || [] })
      );
    } catch (e) {}
    showToast?.(`Skema "${tpl.name}" berhasil dimuat ke kanvas!`, "success");
  };

  // Set / Unset Default Startup Template
  const handleSetDefaultTemplate = async (diag, e) => {
    e?.stopPropagation();
    const isCurrentlyDefault = diag.id === defaultTemplateId || diag.is_default;
    const newDefaultId = isCurrentlyDefault ? null : diag.id;

    const updated = savedDiagrams.map((d) => ({
      ...d,
      is_default: d.id === newDefaultId,
    }));
    setSavedDiagrams(updated);
    setDefaultTemplateId(newDefaultId);

    try {
      localStorage.setItem("nocr_saved_topology_templates", JSON.stringify(updated));
      if (newDefaultId) {
        localStorage.setItem("nocr_default_topology_id", newDefaultId);
      } else {
        localStorage.removeItem("nocr_default_topology_id");
      }
    } catch (err) {}

    showToast?.(
      newDefaultId
        ? `⭐ Skema "${diag.name}" ditetapkan sebagai template default startup!`
        : `Default startup untuk skema "${diag.name}" dinonaktifkan.`,
      "success"
    );

    try {
      await axios.post("/api/topology/architecture", {
        defaultId: newDefaultId,
      });
    } catch (err) {
      console.warn("Gagal update default di server:", err);
    }
  };

  // Delete Saved Template from Folder
  const handleDeleteTemplate = async (id, name, e) => {
    e?.stopPropagation();
    if (!confirm(`Apakah Anda yakin ingin menghapus skema "${name}" dari folder template?`)) return;

    const updated = savedDiagrams.filter((d) => d.id !== id);
    setSavedDiagrams(updated);
    if (defaultTemplateId === id) {
      setDefaultTemplateId(null);
      try {
        localStorage.removeItem("nocr_default_topology_id");
      } catch (err) {}
    }
    try {
      localStorage.setItem("nocr_saved_topology_templates", JSON.stringify(updated));
    } catch (err) {}

    showToast?.(`Skema "${name}" berhasil dihapus dari folder template`, "info");
    try {
      await axios.delete(`/api/topology/architecture?id=${id}`);
    } catch (err) {
      console.warn("Gagal hapus di server:", err);
    }
  };

  // Clear All Modal Trigger
  const handleClearAll = () => {
    setShowDeleteAllModal(true);
  };

  const confirmClearAll = () => {
    setNodes([]);
    setLinks([]);
    setAreas([]);
    setSelectedNodeId(null);
    setSelectedLinkId(null);
    pushState([], [], []);
    setShowDeleteAllModal(false);
    try {
      localStorage.setItem(
        "nocr_active_canvas_session",
        JSON.stringify({ title: activeTemplateName, nodes: [], links: [], areas: [] })
      );
    } catch (e) {}
    showToast?.("Seluruh kanvas berhasil dikosongkan", "info");
  };

  // Export to Image (PNG)
  const handleExportImage = async () => {
    try {
      showToast?.("Memproses ekspor diagram gambar...", "info");
      const element = document.getElementById("topology-export-container");
      if (!element) return;

      const filter = (domNode) => {
        if (!domNode) return true;
        if (domNode.classList && (
          domNode.classList.contains("export-exclude") ||
          domNode.classList.contains("topology-ui-overlay")
        )) {
          return false;
        }
        if (typeof domNode.getAttribute === "function") {
          if (domNode.getAttribute("data-export-ignore") === "true") return false;
        }
        return true;
      };

      const dataUrl = await toPng(element, {
        backgroundColor: "#0d1117",
        quality: 0.98,
        pixelRatio: 2,
        filter,
      });

      const link = document.createElement("a");
      link.download = `NOCR-Topologi-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      showToast?.("Diagram berhasil diunduh dalam format PNG resolusi tinggi!", "success");
    } catch (err) {
      console.error(err);
      showToast?.("Gagal mengekspor gambar", "error");
    }
  };

  // Export to JSON File
  const handleExportJSON = () => {
    const data = {
      version: "2.0",
      title: activeTemplateName,
      exportedAt: new Date().toISOString(),
      nodes,
      links,
      areas: areas || [],
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `topologi-${activeTemplateName.toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast?.("File JSON topologi berhasil diekspor!", "success");
  };

  // Import JSON File
  const handleImportJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (Array.isArray(parsed.nodes) && Array.isArray(parsed.links)) {
          setNodes(parsed.nodes);
          setLinks(parsed.links);
          if (Array.isArray(parsed.areas)) {
            setAreas(parsed.areas);
          } else {
            setAreas([]);
          }
          if (parsed.title) setActiveTemplateName(parsed.title);
          pushState(parsed.nodes, parsed.links, parsed.areas || []);
          showToast?.("Topologi berhasil diimpor dari file JSON!", "success");
        } else {
          showToast?.("Format file JSON tidak sesuai", "error");
        }
      } catch (err) {
        showToast?.("Gagal membaca file JSON", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Smart Save: Overwrite if same name, New Template if different name
  const handleSaveToServer = async () => {
    const title = saveTitle.trim();
    if (!title) {
      showToast?.("Mohon masukkan nama skema topologi", "warning");
      return;
    }

    // Check if name matches an existing saved diagram (case-insensitive)
    const existingIndex = savedDiagrams.findIndex(
      (d) => d.name.trim().toLowerCase() === title.toLowerCase()
    );
    const isOverwrite = existingIndex >= 0;

    let targetId;
    let targetIsDefault = false;
    let targetCategory = "Kustom";
    let targetDesc = saveDesc.trim();

    if (isOverwrite) {
      const existing = savedDiagrams[existingIndex];
      targetId = existing.id;
      targetIsDefault = existing.is_default || existing.id === defaultTemplateId || false;
      targetCategory = existing.category || "Kustom";
      if (!targetDesc) targetDesc = existing.description || "";
    } else {
      targetId = `diag-${Date.now()}`;
    }

    const newEntry = {
      id: targetId,
      name: title,
      description: targetDesc,
      category: targetCategory,
      is_default: targetIsDefault,
      nodes: nodes || [],
      links: links || [],
      areas: areas || [],
      updatedAt: new Date().toISOString(),
    };

    let updatedDiagrams;
    if (isOverwrite) {
      updatedDiagrams = savedDiagrams.map((d, idx) =>
        idx === existingIndex ? newEntry : d
      );
    } else {
      updatedDiagrams = [newEntry, ...savedDiagrams];
    }

    setSavedDiagrams(updatedDiagrams);
    try {
      localStorage.setItem("nocr_saved_topology_templates", JSON.stringify(updatedDiagrams));
      localStorage.setItem(
        "nocr_active_canvas_session",
        JSON.stringify({ title, nodes, links, areas })
      );
    } catch (e) {}

    setActiveTemplateName(title);
    setShowSaveModal(false);
    showToast?.(
      isOverwrite
        ? `Skema "${title}" berhasil diperbarui!`
        : `Skema baru "${title}" berhasil disimpan ke folder template!`,
      "success"
    );

    // Also persist to API
    try {
      await axios.post("/api/topology/architecture", newEntry);
    } catch (e) {
      console.warn("Tersimpan di cache lokal browser:", e);
    }
  };

  // Simulation Actions
  const handleSimulateCascadeFailure = () => {
    // Randomly turn off 1 core node and 2 dependent nodes
    if (nodes.length === 0) return;
    const onlineNodes = nodes.filter((n) => n.status === "online");
    if (onlineNodes.length === 0) {
      showToast?.("Semua node sudah dalam status mati", "warning");
      return;
    }

    const randomIndex = Math.floor(Math.random() * onlineNodes.length);
    const targetNode = onlineNodes[randomIndex];

    handleSetNodes((prev) =>
      prev.map((n) => (n.id === targetNode.id ? { ...n, status: "offline" } : n))
    );

    showToast?.(
      `🚨 Gangguan Disimulasikan: ${targetNode.label} mengalami gangguan/mati!`,
      "error"
    );
  };

  const handleSimulatePingBurst = () => {
    setSimulationSpeed(2.5);
    showToast?.("⚡ Gelombang trafik & uji ping dikirim ke semua link aktif!", "info");
    setTimeout(() => {
      setSimulationSpeed(1);
    }, 4000);
  };

  const handleTurnAllOnline = () => {
    handleSetNodes((prev) => prev.map((n) => ({ ...n, status: "online" })));
    handleSetLinks((prev) => prev.map((l) => ({ ...l, status: "online" })));
    showToast?.("🟢 Seluruh perangkat dan jalur dinyalakan (Online)", "success");
  };

  const handleTurnAllOffline = () => {
    handleSetNodes((prev) => prev.map((n) => ({ ...n, status: "offline" })));
    handleSetLinks((prev) => prev.map((l) => ({ ...l, status: "offline" })));
    showToast?.("🔴 Seluruh perangkat dan jalur dimatikan (Offline)", "warning");
  };

  // Calculated Stats
  const onlineCount = effectiveNodes.filter((n) => n.status === "online").length;
  const offlineCount = effectiveNodes.filter((n) => n.status === "offline").length;

  if (!perms.canRead) {
    return (
      <div className="-m-4 md:-m-6 h-[calc(100vh-4.5rem)] flex items-center justify-center p-8 bg-slate-950 text-slate-100 select-none">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <ShieldAlert size={32} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-100">Akses Dibatasi</h2>
            <p className="text-xs text-slate-400">
              Role akun Anda (<span className="text-amber-400 font-semibold">{currentUser?.role || "Visitor"}</span>) tidak memiliki izin untuk melihat halaman Topologi Jaringan.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="block w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-4 md:-m-6 h-[calc(100vh-4.5rem)] flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Hidden File Input for JSON Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportJSON}
        accept=".json"
        className="hidden"
      />

      {/* ========================================================
          TOP HEADER & TOOLBAR
          ======================================================== */}
      <header className="flex-shrink-0 bg-slate-900 border-b border-slate-700/60 px-3 py-1.5 sm:px-4 sm:py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 z-40">
        {/* Left Section: Title & Status + Search */}
        <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)] flex-shrink-0">
              <GitGraph size={15} />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-100 truncate max-w-[130px] sm:max-w-[240px]">
                  {activeTemplateName}
                </span>
                <span className="text-[9px] sm:text-[10px] text-emerald-400 font-semibold flex items-center gap-1 flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="hidden xs:inline">Live Canvas</span>
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-400 truncate hidden xs:inline">
                Arsitektur Topologi Jaringan Interaktif
              </span>
            </div>
          </div>

          {/* Search Bar / Area Box Navigator */}
          <div className="relative flex-shrink-0" ref={searchRef}>
            <div className="flex items-center bg-slate-950/90 border border-slate-800 hover:border-slate-700 focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500/50 rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 gap-1.5 shadow-inner w-36 xs:w-44 sm:w-56 md:w-64 transition-all">
              <Search size={12} className="text-sky-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Cari Area / Perangkat..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                className="bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none w-full"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setIsSearchOpen(false);
                  }}
                  className="cursor-pointer text-slate-500 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
              <kbd className="hidden md:inline-block bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-[9px] font-mono text-slate-400">
                /
              </kbd>
            </div>

            {/* Search Results Dropdown */}
            {isSearchOpen && (
              <div className="absolute right-0 sm:left-0 top-9 sm:top-10 w-72 sm:w-84 bg-slate-900/95 border border-slate-700/90 rounded-2xl p-2 shadow-2xl backdrop-blur-xl z-50 max-h-96 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95">
                {/* 1. Area Boxes Section */}
                <div className="p-1">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 px-1">
                    <span className="flex items-center gap-1.5 text-sky-400">
                      <Box size={12} />
                      <span>Kotak Area ({filteredAreas.length})</span>
                    </span>
                    <span className="text-[9px] font-normal text-slate-500">Klik untuk fokus</span>
                  </div>

                  {filteredAreas.length > 0 ? (
                    <div className="space-y-1">
                      {filteredAreas.map((area) => {
                        const theme = AREA_THEMES[area.color || "blue"] || AREA_THEMES.blue;
                        const count = (nodes || []).filter((n) => {
                          const cx = n.x + 105;
                          const cy = n.y + 43;
                          return (
                            cx >= area.x &&
                            cx <= area.x + area.width &&
                            cy >= area.y &&
                            cy <= area.y + area.height
                          );
                        }).length;

                        return (
                          <button
                            key={area.id}
                            onClick={() => handleSelectAreaFromSearch(area)}
                            className="cursor-pointer w-full flex items-center justify-between p-2 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 transition group text-left"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-2.5 h-2.5 rounded-full ${theme.dot} flex-shrink-0 shadow-sm`} />
                              <span className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                                {area.name}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                              {count} unit
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic p-2 text-center bg-slate-950/30 rounded-lg">
                      Tidak ada kotak area.
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px bg-slate-800 my-1" />

                {/* 2. Device Nodes Section */}
                <div className="p-1">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 px-1">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <Layers size={12} />
                      <span>Perangkat Jaringan ({filteredNodes.length})</span>
                    </span>
                    <span className="text-[9px] font-normal text-slate-500">Klik untuk fokus</span>
                  </div>

                  {filteredNodes.length > 0 ? (
                    <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                      {filteredNodes.map((node) => (
                        <button
                          key={node.id}
                          onClick={() => handleSelectNodeFromSearch(node)}
                          className="cursor-pointer w-full flex items-center justify-between p-2 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 transition group text-left"
                        >
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                              {node.label}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                              <span className="uppercase font-semibold text-[9px]">{node.vendor || node.type}</span>
                              {node.ip && <span>• {maskIpAddress(node.ip, !perms.canUpdate)}</span>}
                            </div>
                          </div>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              node.status === "online"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-red-500/20 text-red-400 border border-red-500/30"
                            }`}
                          >
                            {node.status === "online" ? "Online" : "Offline"}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic p-2 text-center bg-slate-950/30 rounded-lg">
                      Tidak ada perangkat yang cocok.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Action Buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto custom-scrollbar max-w-full pb-0.5 sm:pb-0">
          {/* New Canvas Button */}
          {(perms.canCreate || perms.canUpdate) && (
            <button
              onClick={handleNewCanvas}
              title="Mulai Kanvas Baru Kosong"
              className="cursor-pointer flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-semibold transition flex-shrink-0"
            >
              <Plus size={13} />
              <span className="hidden sm:inline">Kanvas Baru</span>
            </button>
          )}

          {/* Folder Template Button (Hanya untuk yang memiliki akses edit/kelola) */}
          {(perms.canCreate || perms.canUpdate) && (
            <button
              onClick={() => setShowTemplateModal(true)}
              title="Buka Folder Template & Skema Tersimpan"
              className="cursor-pointer flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition flex-shrink-0"
            >
              <FolderOpen size={13} className="text-amber-400" />
              <span className="hidden md:inline">Folder Template</span>
              {savedDiagrams.length > 0 && (
                <span className="bg-amber-400/20 text-amber-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {savedDiagrams.length}
                </span>
              )}
            </button>
          )}

          {/* Undo / Redo */}
          {(perms.canCreate || perms.canUpdate) && (
            <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 p-0.5 flex-shrink-0">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                title="Urungkan Perubahan (Ctrl+Z)"
                className="cursor-pointer p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <RotateCcw size={13} />
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                title="Ulangi Perubahan (Ctrl+Y)"
                className="cursor-pointer p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <RotateCw size={13} />
              </button>
            </div>
          )}

          {/* Save Button */}
          {(perms.canCreate || perms.canUpdate) && (
            <button
              onClick={() => {
                setSaveTitle(activeTemplateName === "Skema Baru" ? "" : activeTemplateName);
                setShowSaveModal(true);
              }}
              title="Simpan Diagram Topologi ke Folder Template"
              className="cursor-pointer flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-500/20 flex-shrink-0"
            >
              <Save size={13} />
              <span className="hidden sm:inline">Simpan</span>
            </button>
          )}

          {/* Toggle Animasi Aliran Kabel */}
          <button
            onClick={() => setSimulationActive((prev) => !prev)}
            title={simulationActive ? "Matikan Animasi Aliran Kabel & Trafik" : "Aktifkan Animasi Aliran Kabel & Trafik"}
            className={`cursor-pointer flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg border text-xs font-semibold transition flex-shrink-0 ${
              simulationActive
                ? "bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400"
            }`}
          >
            {simulationActive ? (
              <>
                <Pause size={13} className="text-amber-400" />
                <span className="hidden lg:inline">Animasi (ON)</span>
              </>
            ) : (
              <>
                <Play size={13} className="text-slate-400" />
                <span className="hidden lg:inline">Animasi (OFF)</span>
              </>
            )}
          </button>

          {/* Export PNG */}
          <button
            onClick={handleExportImage}
            title="Ekspor Diagram ke Gambar PNG"
            className="cursor-pointer flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition flex-shrink-0"
          >
            <ImageIcon size={13} className="text-sky-400" />
            <span className="hidden lg:inline">Ekspor PNG</span>
          </button>

          {/* Export/Import JSON */}
          <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 p-0.5 flex-shrink-0">
            <button
              onClick={handleExportJSON}
              title="Unduh File JSON Topologi"
              className="cursor-pointer p-1 sm:p-1.5 text-slate-400 hover:text-emerald-400 transition"
            >
              <Download size={13} />
            </button>
            {(perms.canCreate || perms.canUpdate) && (
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Unggah File JSON Topologi"
                className="cursor-pointer p-1 sm:p-1.5 text-slate-400 hover:text-emerald-400 transition"
              >
                <Upload size={13} />
              </button>
            )}
          </div>

          {/* Clear Canvas */}
          {perms.canDelete && (
            <button
              onClick={handleClearAll}
              title="Kosongkan Kanvas"
              className="cursor-pointer p-1 sm:p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 hover:text-white transition flex-shrink-0"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </header>

      {/* ========================================================
          MAIN WORKSPACE (Palette | Canvas | Inspector)
          ======================================================== */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* Left Drawer: Hardware Device Palette (Hanya untuk yang punya hak edit) */}
        {(perms.canCreate || perms.canUpdate) && isPaletteOpen && (
          <DevicePalette
            liveMappings={liveMappings}
            liveDevices={liveDevices}
            canvasNodes={nodes}
            readOnly={!perms.canUpdate}
            canCreate={perms.canCreate || perms.canUpdate}
            onClose={() => setIsPaletteOpen(false)}
            onAddNodeDirect={(item) => {
              if (!perms.canCreate && !perms.canUpdate) return;
              // Prevent duplicate Master Agregator
              if (item.is_aggregate) {
                const existing = nodes.find(
                  (n) => n.is_aggregate && n.aggregate_type === item.aggregate_type
                );
                if (existing) {
                  setSelectedNodeId(existing.id);
                  showToast?.(`Master Agregator "${item.label}" sudah ada di kanvas`, "warning");
                  return;
                }

                const newNode = {
                  id: `node-${Date.now()}`,
                  type: item.type || "router",
                  nocr_hw_type: item.nocr_hw_type || item.type,
                  nocr_category: item.nocr_category,
                  label: item.label,
                  sublabel: item.sublabel,
                  vendor: item.vendor,
                  is_aggregate: true,
                  aggregate_type: item.aggregate_type,
                  total_count: item.total_count || item.total,
                  online_count: item.online_count || item.online,
                  offline_count: item.offline_count || item.offline,
                  status: item.status || (item.online > 0 ? "online" : "offline"),
                  x: 400,
                  y: 300,
                };
                setNodes((prev) => [...prev, newNode]);
                pushState([...nodes, newNode], links);
                setSelectedNodeId(newNode.id);
                showToast?.(`Master Agregator "${item.label}" ditambahkan ke kanvas`, "success");
                return;
              }

              // Prevent duplicate NOCR devices
              if (item.is_live_nocr) {
                const existing = nodes.find(
                  (n) =>
                    isSameSite(n, {
                      prefix: item.mapping_prefix,
                      ruijie_mac: item.mapping_mac,
                      site_name: item.label,
                    }) && matchHardwareType(n, item.nocr_hw_type || item.type)
                );
                if (existing) {
                  setSelectedNodeId(existing.id);
                  showToast?.(`Perangkat ${item.label} (${item.vendor || item.nocr_hw_type}) sudah ada di kanvas`, "warning");
                  return;
                }
              }

              const newNode = {
                id: `node-${Date.now()}`,
                type: item.type || "router",
                nocr_hw_type: item.nocr_hw_type,
                nocr_category: item.nocr_category,
                status_source: item.status_source,
                label: item.label || "Node Baru",
                sublabel: item.sublabel || "",
                vendor: item.vendor || "",
                ports: item.ports || "",
                ip: item.ip || "",
                status: item.status || "online",
                mapping_prefix: item.mapping_prefix,
                mapping_mac: item.mapping_mac,
                is_live_nocr: item.is_live_nocr,
                x: 400,
                y: 300,
              };
              setNodes((prev) => [...prev, newNode]);
              pushState([...nodes, newNode], links);
              setSelectedNodeId(newNode.id);
              showToast?.(`Perangkat ${item.label} (${item.vendor || item.nocr_hw_type}) ditambahkan ke kanvas`, "success");
            }}
          />
        )}

        {/* Central Canvas Viewport */}
        <div id="topology-export-container" className="flex-1 min-w-0 h-full relative">
          {/* Floating Button to open Palette when closed (Hanya jika punya hak edit) */}
          {(perms.canCreate || perms.canUpdate) && !isPaletteOpen && (
            <button
              data-export-ignore="true"
              onClick={() => setIsPaletteOpen(true)}
              title="Buka Katalog Perangkat"
              className="export-exclude cursor-pointer absolute top-3 left-3 sm:top-4 sm:left-4 z-30 flex items-center gap-1.5 sm:gap-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-bold text-slate-200 hover:text-white shadow-2xl backdrop-blur-md transition group"
            >
              <PanelLeftOpen size={15} className="text-emerald-400 group-hover:scale-110 transition-transform flex-shrink-0" />
              <span className="hidden sm:inline">Katalog Perangkat</span>
            </button>
          )}

          {/* Floating Button to open Properties Drawer when closed (Hanya jika punya hak edit/kelola) */}
          {(perms.canCreate || perms.canUpdate) && !isPropertiesOpen && (
            <button
              data-export-ignore="true"
              onClick={() => setIsPropertiesOpen(true)}
              title="Buka Ringkasan Topologi"
              className="export-exclude cursor-pointer absolute top-3 right-3 sm:top-4 sm:right-4 z-30 flex items-center gap-1.5 sm:gap-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-bold text-slate-200 hover:text-white shadow-2xl backdrop-blur-md transition group"
            >
              <span className="hidden sm:inline">Ringkasan Topologi</span>
              <PanelRightOpen size={15} className="text-blue-400 group-hover:scale-110 transition-transform flex-shrink-0" />
            </button>
          )}

          <TopologyCanvas
            nodes={effectiveNodes}
            links={links}
            areas={areas}
            setNodes={setNodes}
            setLinks={setLinks}
            setAreas={setAreas}
            onNodeDragEnd={handleNodeDragEnd}
            onAreaDragEnd={(newNodes, newLinks, newAreas) => {
              pushState(
                newNodes !== undefined ? newNodes : nodes,
                newLinks !== undefined ? newLinks : links,
                newAreas !== undefined ? newAreas : areas
              );
            }}
            selectedNodeId={selectedNodeId}
            selectedLinkId={selectedLinkId}
            onSelectNode={handleSelectNode}
            onSelectLink={handleSelectLink}
            onDeselectAll={handleDeselectAll}
            onUpdateNode={handleUpdateNode}
            onUpdateLink={handleUpdateLink}
            onDeleteNode={handleDeleteNode}
            onDeleteLink={handleDeleteLink}
            onDuplicateNode={handleDuplicateNode}
            onToggleNodeStatus={handleToggleNodeStatus}
            gridStyle={gridStyle}
            snapToGrid={snapToGrid}
            simulationActive={simulationActive}
            setSimulationActive={setSimulationActive}
            simulationSpeed={simulationSpeed}
            showLabels={showLabels}
            canvasRef={canvasExportRef}
            readOnly={!perms.canUpdate}
            canDelete={perms.canDelete}
            hasFloatingRight={(perms.canCreate || perms.canUpdate) && !isPropertiesOpen}
            focusTarget={focusTarget}
          />
        </div>

        {/* Right Drawer: Properties Inspector (Hanya jika punya hak edit/kelola) */}
        {(perms.canCreate || perms.canUpdate) && isPropertiesOpen && (
          <PropertiesDrawer
            selectedNode={selectedNode}
            selectedLink={selectedLink}
            nodes={effectiveNodes}
            liveMappings={liveMappings}
            onUpdateNode={handleUpdateNode}
            onUpdateLink={handleUpdateLink}
            onDeleteNode={handleDeleteNode}
            onDeleteLink={handleDeleteLink}
            onDuplicateNode={handleDuplicateNode}
            onClose={() => handleDeselectAll()}
            onCloseDrawer={() => setIsPropertiesOpen(false)}
            nodesCount={effectiveNodes.length}
            linksCount={links.length}
            onlineNodesCount={onlineCount}
            offlineNodesCount={offlineCount}
            gridStyle={gridStyle}
            setGridStyle={setGridStyle}
            snapToGrid={snapToGrid}
            setSnapToGrid={setSnapToGrid}
            readOnly={!perms.canUpdate}
            canDelete={perms.canDelete}
          />
        )}
      </div>

      {/* ========================================================
          MODAL: FOLDER TEMPLATE & SKEMA TERSIMPAN
          ======================================================== */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                  <FolderOpen size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <span>Folder Template & Skema</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700">
                      {savedDiagrams.length} Tersimpan
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Pilih skema tersimpan untuk dimuat ke kanvas atau buat skema baru
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="cursor-pointer text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Quick Actions & Search */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Cari skema template tersimpan..."
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                onClick={() => {
                  handleNewCanvas();
                  setShowTemplateModal(false);
                }}
                className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-semibold text-xs transition"
              >
                <Plus size={13} />
                <span>Kanvas Baru</span>
              </button>
            </div>

            {/* List of Saved Schemas */}
            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar p-1">
              {savedDiagrams.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 mx-auto flex items-center justify-center border border-slate-700">
                    <FolderOpen size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">
                      Belum Ada Template Tersimpan
                    </h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                      Rancang arsitektur topologi Anda di kanvas, lalu klik tombol{" "}
                      <strong className="text-blue-400">Simpan</strong> di kanan atas untuk menyimpannya ke dalam folder template ini.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      handleNewCanvas();
                      setShowTemplateModal(false);
                    }}
                    className="cursor-pointer px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition inline-flex items-center gap-1.5"
                  >
                    <Plus size={13} />
                    <span>Mulai Gambar di Kanvas</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {savedDiagrams
                    .filter((diag) =>
                      !templateSearch ||
                      diag.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
                      (diag.description && diag.description.toLowerCase().includes(templateSearch.toLowerCase()))
                    )
                    .map((diag) => (
                      <div
                        key={diag.id}
                        onClick={() => handleLoadTemplate(diag)}
                        className="cursor-pointer p-4 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-amber-500/80 hover:bg-slate-800/50 transition group space-y-2 flex flex-col justify-between shadow-md relative"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md uppercase border border-amber-500/20">
                                {diag.category || "Kustom"}
                              </span>
                              {(diag.is_default || diag.id === defaultTemplateId) && (
                                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-400/40 shadow-[0_0_8px_rgba(251,191,36,0.3)] animate-pulse">
                                  <Star size={10} className="fill-amber-300" />
                                  <span>Default Startup</span>
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {(diag.nodes || []).length} Node • {(diag.links || []).length} Kabel
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-slate-100 group-hover:text-amber-300 transition">
                            {diag.name}
                          </h4>

                          {diag.description && (
                            <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                              {diag.description}
                            </p>
                          )}

                          {diag.updatedAt && (
                            <div className="text-[10px] text-slate-500 pt-0.5">
                              Disimpan: {new Date(diag.updatedAt).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </div>
                          )}
                        </div>

                        <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-amber-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            <span>Gunakan Skema</span>
                            <span>→</span>
                          </span>

                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {/* Star Default Button */}
                            <button
                              onClick={(e) => handleSetDefaultTemplate(diag, e)}
                              title={
                                diag.is_default || diag.id === defaultTemplateId
                                  ? "Template Default Utama (Klik untuk batal)"
                                  : "Jadikan Template Default Startup"
                              }
                              className={`cursor-pointer px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition border ${
                                diag.is_default || diag.id === defaultTemplateId
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm"
                                  : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-amber-300 hover:bg-slate-800 hover:border-amber-500/30"
                              }`}
                            >
                              <Star
                                size={12}
                                className={diag.is_default || diag.id === defaultTemplateId ? "fill-amber-400 text-amber-400" : ""}
                              />
                              <span className="text-[10px]">
                                {diag.is_default || diag.id === defaultTemplateId ? "Default" : "Set Default"}
                              </span>
                            </button>

                            {/* Delete Button */}
                            {perms.canDelete && (
                              <button
                                onClick={(e) => handleDeleteTemplate(diag.id, diag.name, e)}
                                title="Hapus dari Folder"
                                className="cursor-pointer p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: SAVE TOPOLOGY
          ======================================================== */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Save size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Simpan Skema Topologi
                  </h3>
                  <p className="text-xs text-slate-400">
                    Simpan diagram arsitektur ke folder template
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSaveModal(false)}
                className="cursor-pointer text-slate-400 hover:text-white p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 flex items-center justify-between">
                  <span>Nama Skema / Judul Topologi</span>
                  {saveTitle.trim() && (
                    <span className="text-[10px] text-slate-400">
                      {savedDiagrams.some((d) => d.name.trim().toLowerCase() === saveTitle.trim().toLowerCase())
                        ? "⚠️ Nama sudah ada"
                        : "✨ Nama baru"}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="misal: Topologi Utama Fiber Diskominfo 2026"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                />

                {/* Dynamic Smart Save Indicator */}
                {saveTitle.trim() && (
                  savedDiagrams.some((d) => d.name.trim().toLowerCase() === saveTitle.trim().toLowerCase()) ? (
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[11px]">
                      <RefreshCw size={12} className="flex-shrink-0 text-blue-400 animate-spin" style={{ animationDuration: "6s" }} />
                      <span>Nama template sama. Menyimpan akan <strong>menimpa </strong> template ini.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px]">
                      <Plus size={12} className="flex-shrink-0 text-emerald-400" />
                      <span>Nama template baru. Menyimpan akan <strong>membuat template baru</strong> di folder.</span>
                    </div>
                  )
                )}
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">
                  Keterangan / Catatan
                </label>
                <textarea
                  rows={3}
                  placeholder="Catatan mengenai jalur fiber, link backup, atau kapasitas perangkat..."
                  value={saveDesc}
                  onChange={(e) => setSaveDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowSaveModal(false)}
                className="cursor-pointer px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
              >
                Batal
              </button>
              <button
                onClick={handleSaveToServer}
                className="cursor-pointer px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-md shadow-blue-500/20"
              >
                {saveTitle.trim() && savedDiagrams.some((d) => d.name.trim().toLowerCase() === saveTitle.trim().toLowerCase())
                  ? "Perbarui Template"
                  : "Simpan Template Baru"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CONFIRM DELETE ALL CANVAS
          ======================================================== */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30 flex-shrink-0 shadow-[0_0_12px_rgba(239,68,68,0.3)]">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  Kosongkan Seluruh Kanvas?
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tindakan ini akan menghapus semua node dan kabel.
                </p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 space-y-1">
              <p>
                Semua <span className="text-red-400 font-bold">{nodes.length} perangkat</span> dan{" "}
                <span className="text-red-400 font-bold">{links.length} jalur kabel</span> akan dihapus dari kanvas aktif.
              </p>
              <p className="text-[11px] text-slate-500">
                Catatan: Anda tetap dapat menggunakan tombol Undo (<kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-300">Ctrl+Z</kbd>) jika tidak sengaja.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowDeleteAllModal(false)}
                className="cursor-pointer px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition border border-slate-700"
              >
                Batal
              </button>
              <button
                onClick={confirmClearAll}
                className="cursor-pointer px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition shadow-lg shadow-red-600/30 flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>Ya, Kosongkan Kanvas</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
