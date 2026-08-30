"use client";
import React, { useRef, useState, useEffect, useCallback } from "react";
import NodeCard from "./NodeCard";
import PathRenderer from "./PathRenderer";
import AreaBox from "./AreaBox";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Play, Pause } from "lucide-react";
import { matchHardwareType, isSameSite } from "./DevicePalette";

export default function TopologyCanvas({
  nodes = [],
  links = [],
  areas = [],
  setNodes,
  setLinks,
  setAreas,
  selectedNodeId,
  selectedLinkId,
  onSelectNode,
  onSelectLink,
  onDeselectAll,
  onUpdateNode,
  onUpdateLink,
  onDeleteNode,
  onDeleteLink,
  onDuplicateNode,
  onToggleNodeStatus,
  onNodeDragEnd,
  onAreaDragEnd,
  gridStyle = "dots",
  snapToGrid = false,
  simulationActive = true,
  setSimulationActive,
  simulationSpeed = 1,
  showLabels = true,
  canvasRef,
  readOnly = false,
  canDelete = true,
  hasFloatingRight = false,
  focusTarget = null,
}) {
  const containerRef = useRef(null);

  // Pan & Zoom State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Highlighted Area Box (from search focus)
  const [highlightedAreaId, setHighlightedAreaId] = useState(null);

  // Node Dragging State
  const draggingNodeRef = useRef(null); // nodeId
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const hasMovedNodeRef = useRef(false);

  // Area Box Dragging & Resizing State
  const draggingAreaRef = useRef(null); // areaId
  const dragAreaStartCanvasRef = useRef({ x: 0, y: 0 });
  const initialAreaPosRef = useRef({ x: 0, y: 0 });
  const containedNodeIdsRef = useRef([]);
  const initialNodePositionsRef = useRef([]);
  const hasMovedAreaRef = useRef(false);

  const resizingAreaRef = useRef(null); // areaId
  const resizeStartAreaRef = useRef(null); // { x, y, width, height }
  const resizeStartCanvasRef = useRef(null);
  const resizeDirectionRef = useRef("se"); // 'n','s','e','w','ne','nw','se','sw'

  // Right-Click Drag Area Creation Draft
  const [areaDraft, setAreaDraft] = useState(null); // { startX, startY, currentX, currentY }
  const isRightDraggingRef = useRef(false);
  const rightDragStartRef = useRef(null);

  // Link Connection State
  const [linkStart, setLinkStart] = useState(null); // { nodeId, port }
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Spacebar pan mode
  const [spacePressed, setSpacePressed] = useState(false);
  const spacePressedRef = useRef(false);
  spacePressedRef.current = spacePressed;

  // Convert screen coordinates to canvas space
  const screenToCanvas = useCallback(
    (clientX, clientY) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = clientX - rect.left;
      const rawY = clientY - rect.top;
      const x = (rawX - pan.x) / zoom;
      const y = (rawY - pan.y) / zoom;
      return { x, y };
    },
    [pan, zoom]
  );

  // Keyboard Shortcuts (Space, Delete, Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.code === "Space" &&
        !e.repeat &&
        document.activeElement.tagName !== "INPUT" &&
        document.activeElement.tagName !== "TEXTAREA"
      ) {
        setSpacePressed(true);
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        document.activeElement.tagName !== "INPUT" &&
        document.activeElement.tagName !== "TEXTAREA"
      ) {
        if (selectedNodeId) onDeleteNode?.(selectedNodeId);
        else if (selectedLinkId) onDeleteLink?.(selectedLinkId);
      }
      if (e.key === "Escape") {
        setLinkStart(null);
        setAreaDraft(null);
        isRightDraggingRef.current = false;
        onDeselectAll?.();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === "Space") {
        setSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedNodeId, selectedLinkId, onDeleteNode, onDeleteLink, onDeselectAll]);

  // Handle programmatic focus on area or node from search (Executes ONCE per timestamp)
  const lastHandledFocusRef = useRef(null);

  useEffect(() => {
    if (!focusTarget || !containerRef.current) return;
    if (focusTarget.timestamp && lastHandledFocusRef.current === focusTarget.timestamp) {
      return;
    }
    lastHandledFocusRef.current = focusTarget.timestamp || Date.now();

    if (focusTarget.type === "area") {
      const targetArea = (areas || []).find((a) => a.id === focusTarget.id);
      if (targetArea) {
        const rect = containerRef.current.getBoundingClientRect();
        const padding = 100;
        const boundingWidth = targetArea.width + padding * 2;
        const boundingHeight = targetArea.height + padding * 2;

        const scaleX = rect.width / boundingWidth;
        const scaleY = rect.height / boundingHeight;
        const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.4), 1.5);

        const centerX = targetArea.x + targetArea.width / 2;
        const centerY = targetArea.y + targetArea.height / 2;

        setZoom(newZoom);
        setPan({
          x: rect.width / 2 - centerX * newZoom,
          y: rect.height / 2 - centerY * newZoom,
        });

        setHighlightedAreaId(targetArea.id);
        const timer = setTimeout(() => {
          setHighlightedAreaId(null);
        }, 3000);
        return () => clearTimeout(timer);
      }
    } else if (focusTarget.type === "node") {
      const targetNode = (nodes || []).find((n) => n.id === focusTarget.id);
      if (targetNode) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = targetNode.x + 105;
        const centerY = targetNode.y + 43;
        const newZoom = Math.max(zoom, 1.1);

        setZoom(newZoom);
        setPan({
          x: rect.width / 2 - centerX * newZoom,
          y: rect.height / 2 - centerY * newZoom,
        });
        onSelectNode?.(targetNode);
      }
    }
  }, [focusTarget]);

  // Window-level MouseMove and MouseUp to guarantee 60fps drag without lost events
  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      setMousePos(canvasPos);

      // 1. Right-Click Drag Area Creation Draft
      if (isRightDraggingRef.current && rightDragStartRef.current) {
        setAreaDraft({
          startX: rightDragStartRef.current.x,
          startY: rightDragStartRef.current.y,
          currentX: canvasPos.x,
          currentY: canvasPos.y,
        });
        return;
      }

      // 2. Pan Canvas
      if (isPanningRef.current) {
        setPan({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        });
        return;
      }

      // 3. Drag Area Box + All Contained Nodes
      if (draggingAreaRef.current) {
        hasMovedAreaRef.current = true;
        const deltaX = canvasPos.x - dragAreaStartCanvasRef.current.x;
        const deltaY = canvasPos.y - dragAreaStartCanvasRef.current.y;

        let nextAreaX = initialAreaPosRef.current.x + deltaX;
        let nextAreaY = initialAreaPosRef.current.y + deltaY;
        if (snapToGrid) {
          nextAreaX = Math.round(nextAreaX / 20) * 20;
          nextAreaY = Math.round(nextAreaY / 20) * 20;
        }

        const effectiveDeltaX = nextAreaX - initialAreaPosRef.current.x;
        const effectiveDeltaY = nextAreaY - initialAreaPosRef.current.y;

        // Move Area Box
        if (setAreas) {
          setAreas((prev) =>
            (prev || []).map((a) =>
              a.id === draggingAreaRef.current
                ? { ...a, x: nextAreaX, y: nextAreaY }
                : a
            )
          );
        }

        // Move all contained nodes synchronously
        if (containedNodeIdsRef.current.length > 0) {
          setNodes((prev) =>
            (prev || []).map((n) => {
              if (containedNodeIdsRef.current.includes(n.id)) {
                const initPos = initialNodePositionsRef.current.find((p) => p.id === n.id);
                if (initPos) {
                  return {
                    ...n,
                    x: initPos.x + effectiveDeltaX,
                    y: initPos.y + effectiveDeltaY,
                  };
                }
              }
              return n;
            })
          );
        }
        return;
      }

      // 4. Resize Area Box (Multi-directional)
      if (resizingAreaRef.current && resizeStartAreaRef.current && resizeStartCanvasRef.current) {
        const deltaX = canvasPos.x - resizeStartCanvasRef.current.x;
        const deltaY = canvasPos.y - resizeStartCanvasRef.current.y;
        const dir = resizeDirectionRef.current;
        const s = resizeStartAreaRef.current; // { x, y, width, height }
        const MIN_W = 120;
        const MIN_H = 80;

        let nextX = s.x;
        let nextY = s.y;
        let nextW = s.width;
        let nextH = s.height;

        // Horizontal component
        if (dir.includes("e")) {
          nextW = Math.max(MIN_W, s.width + deltaX);
        } else if (dir.includes("w")) {
          const proposedW = s.width - deltaX;
          if (proposedW >= MIN_W) {
            nextW = proposedW;
            nextX = s.x + deltaX;
          } else {
            nextW = MIN_W;
            nextX = s.x + s.width - MIN_W;
          }
        }

        // Vertical component
        if (dir.includes("s")) {
          nextH = Math.max(MIN_H, s.height + deltaY);
        } else if (dir.includes("n")) {
          const proposedH = s.height - deltaY;
          if (proposedH >= MIN_H) {
            nextH = proposedH;
            nextY = s.y + deltaY;
          } else {
            nextH = MIN_H;
            nextY = s.y + s.height - MIN_H;
          }
        }

        if (setAreas) {
          setAreas((prev) =>
            (prev || []).map((a) =>
              a.id === resizingAreaRef.current
                ? { ...a, x: Math.round(nextX), y: Math.round(nextY), width: Math.round(nextW), height: Math.round(nextH) }
                : a
            )
          );
        }
        return;
      }

      // 5. Drag Single Node
      if (draggingNodeRef.current) {
        hasMovedNodeRef.current = true;
        let nextX = canvasPos.x - dragOffsetRef.current.x;
        let nextY = canvasPos.y - dragOffsetRef.current.y;

        if (snapToGrid) {
          nextX = Math.round(nextX / 20) * 20;
          nextY = Math.round(nextY / 20) * 20;
        }

        setNodes((prev) =>
          prev.map((n) =>
            n.id === draggingNodeRef.current
              ? { ...n, x: nextX, y: nextY }
              : n
          )
        );
      }
    };

    const handleWindowMouseUp = (e) => {
      // Finish Right-Click Drag Area Creation
      if (isRightDraggingRef.current) {
        isRightDraggingRef.current = false;
        if (areaDraft) {
          const minX = Math.min(areaDraft.startX, areaDraft.currentX);
          const minY = Math.min(areaDraft.startY, areaDraft.currentY);
          const width = Math.abs(areaDraft.currentX - areaDraft.startX);
          const height = Math.abs(areaDraft.currentY - areaDraft.startY);

          if (width >= 50 && height >= 40) {
            const colorPalette = ["blue", "emerald", "purple", "amber", "cyan", "rose"];
            const chosenColor = colorPalette[(areas || []).length % colorPalette.length];
            const newArea = {
              id: `area-${Date.now()}`,
              name: `Area ${(areas || []).length + 1}`,
              x: Math.round(minX),
              y: Math.round(minY),
              width: Math.round(width),
              height: Math.round(height),
              color: chosenColor,
            };
            if (setAreas) {
              const updatedAreas = [...(areas || []), newArea];
              setAreas(updatedAreas);
              onAreaDragEnd?.(nodes, links, updatedAreas);
            }
          }
        }
        setAreaDraft(null);
        rightDragStartRef.current = null;
      }

      // Finish Pan
      if (isPanningRef.current) {
        isPanningRef.current = false;
      }

      // Finish Area Drag
      if (draggingAreaRef.current) {
        if (hasMovedAreaRef.current) {
          onAreaDragEnd?.();
        }
        draggingAreaRef.current = null;
        containedNodeIdsRef.current = [];
        initialNodePositionsRef.current = [];
        hasMovedAreaRef.current = false;
      }

      // Finish Area Resize
      if (resizingAreaRef.current) {
        onAreaDragEnd?.();
        resizingAreaRef.current = null;
        resizeStartAreaRef.current = null;
        resizeStartCanvasRef.current = null;
      }

      // Finish Node Drag
      if (draggingNodeRef.current) {
        if (hasMovedNodeRef.current) {
          onNodeDragEnd?.();
        }
        draggingNodeRef.current = null;
        hasMovedNodeRef.current = false;
      }
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [
    screenToCanvas,
    snapToGrid,
    setNodes,
    setAreas,
    onNodeDragEnd,
    onAreaDragEnd,
    areaDraft,
    areas,
    nodes,
    links,
  ]);

  // Wheel Zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.25), 3.0);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Canvas MouseDown (Pan / Deselect / Right Click Area Box Creation)
  const handleCanvasMouseDown = (e) => {
    // If drawing a link, cancel it on background click
    if (linkStart) {
      setLinkStart(null);
    }

    // Right-Click Drag -> Create Area Box
    if (e.button === 2) {
      e.preventDefault();
      if (readOnly) return;
      if (e.target.closest("button") || e.target.closest("input") || e.target.closest(".node-card-interactive")) {
        return;
      }
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      isRightDraggingRef.current = true;
      rightDragStartRef.current = { x: canvasPos.x, y: canvasPos.y };
      setAreaDraft({
        startX: canvasPos.x,
        startY: canvasPos.y,
        currentX: canvasPos.x,
        currentY: canvasPos.y,
      });
      return;
    }

    // If clicking on power button, ports, or cards, ignore
    if (e.target.closest("button") || e.target.closest(".node-card-interactive")) {
      return;
    }

    if (e.button === 0 || e.button === 1 || spacePressedRef.current) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      onDeselectAll?.();
    }
  };

  // Area Box Drag Handlers
  const handleStartDragArea = (area, e) => {
    if (readOnly) return;
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    draggingAreaRef.current = area.id;
    dragAreaStartCanvasRef.current = { x: canvasPos.x, y: canvasPos.y };
    initialAreaPosRef.current = { x: area.x, y: area.y };
    hasMovedAreaRef.current = false;

    // Detect all nodes currently inside this area box (based on node center coordinates)
    const insideNodeIds = (nodes || [])
      .filter((n) => {
        const cx = n.x + 105;
        const cy = n.y + 43;
        return (
          cx >= area.x &&
          cx <= area.x + area.width &&
          cy >= area.y &&
          cy <= area.y + area.height
        );
      })
      .map((n) => n.id);

    containedNodeIdsRef.current = insideNodeIds;
    initialNodePositionsRef.current = (nodes || []).map((n) => ({ id: n.id, x: n.x, y: n.y }));
  };

  const handleStartResizeArea = (area, e, direction = "se") => {
    if (readOnly) return;
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    resizingAreaRef.current = area.id;
    resizeStartAreaRef.current = { x: area.x, y: area.y, width: area.width, height: area.height };
    resizeStartCanvasRef.current = { x: canvasPos.x, y: canvasPos.y };
    resizeDirectionRef.current = direction;
  };

  const handleUpdateArea = (id, updates) => {
    if (setAreas) {
      setAreas((prev) => {
        const next = (prev || []).map((a) => (a.id === id ? { ...a, ...updates } : a));
        onAreaDragEnd?.(nodes, links, next);
        return next;
      });
    }
  };

  const handleDeleteArea = (id) => {
    if (setAreas) {
      setAreas((prev) => {
        const next = (prev || []).filter((a) => a.id !== id);
        onAreaDragEnd?.(nodes, links, next);
        return next;
      });
    }
  };

  // Helper count nodes inside an area
  const getContainedCount = (area) => {
    return (nodes || []).filter((n) => {
      const cx = n.x + 105;
      const cy = n.y + 43;
      return (
        cx >= area.x &&
        cx <= area.x + area.width &&
        cy >= area.y &&
        cy <= area.y + area.height
      );
    }).length;
  };

  const handleStartLink = (nodeId, port = "auto") => {
    if (readOnly) return;
    if (linkStart) {
      if (linkStart.nodeId !== nodeId) {
        handleFinishLink(nodeId, port);
      } else {
        setLinkStart(null);
      }
    } else {
      setLinkStart({ nodeId, port });
    }
  };

  const handleFinishLink = (targetNodeId, targetPort = "auto") => {
    if (!linkStart || linkStart.nodeId === targetNodeId) {
      setLinkStart(null);
      return;
    }

    const fromId = linkStart.nodeId;
    const toId = targetNodeId;

    // Prevent duplicate link between same two nodes
    const exists = links.some(
      (l) => (l.from === fromId && l.to === toId) || (l.from === toId && l.to === fromId)
    );

    if (!exists) {
      const fromNode = nodes.find((n) => n.id === fromId);
      const toNode = nodes.find((n) => n.id === toId);

      let defaultCable = "fiber";
      let defaultLabel = "FO Trunk";

      const fromType = (fromNode?.nocr_hw_type || fromNode?.type || "").toLowerCase();
      const toType = (toNode?.nocr_hw_type || toNode?.type || "").toLowerCase();
      const fromVendor = (fromNode?.vendor || "").toLowerCase();
      const toVendor = (toNode?.vendor || "").toLowerCase();

      const isFromVPN = fromType === "vpn" || fromVendor.includes("vpn");
      const isToVPN = toType === "vpn" || toVendor.includes("vpn");

      const isFromONT = fromType === "ont" || fromVendor.includes("modem") || fromVendor.includes("ont");
      const isToONT = toType === "ont" || toVendor.includes("modem") || toVendor.includes("ont");

      const isFromMikrotik = fromType === "router" || fromType === "mikrotik" || fromVendor.includes("mikrotik");
      const isToMikrotik = toType === "router" || toType === "mikrotik" || toVendor.includes("mikrotik");

      const isFromAP = fromType === "ap" || fromType === "ruijie" || fromVendor.includes("ruijie") || fromVendor.includes("ap");
      const isToAP = toType === "ap" || toType === "ruijie" || toVendor.includes("ruijie") || toVendor.includes("ap");

      if (isFromVPN || isToVPN) {
        // Hubungan ke VPN Tunneling selalu kabel VPN (Oranye)
        defaultCable = "vpn";
        defaultLabel = "VPN";
      } else if (
        (isFromONT && (isToMikrotik || isToAP)) ||
        (isToONT && (isFromMikrotik || isFromAP)) ||
        (isFromMikrotik && isToAP) ||
        (isToMikrotik && isFromAP) ||
        isFromAP || isToAP ||
        fromType === "client" || toType === "client"
      ) {
        // Hubungan antar perangkat di lokasi OPD / Desa (Modem ONT -> MikroTik, Modem ONT -> Ruijie AP, MikroTik -> Ruijie AP)
        defaultCable = "ethernet";
        defaultLabel = "LAN Cat6";
      }

      const newLink = {
        id: `link-${Date.now()}`,
        from: fromId,
        to: toId,
        fromPort: linkStart.port,
        toPort: targetPort,
        type: defaultCable,
        label: defaultLabel,
        status: "online",
        speed: 1.0,
      };
      setLinks((prev) => [...prev, newLink]);
    }

    setLinkStart(null);
  };

  // Node MouseDown (Start Dragging / Connect Link)
  const handleNodeMouseDown = (e, node) => {
    if (e.target.closest("button")) return;

    e.stopPropagation();
    if (e.button === 2) {
      // Let right-click propagate to canvas background if wanted, or prevent
      return;
    }

    e.preventDefault();

    if (linkStart) {
      if (linkStart.nodeId !== node.id) {
        handleFinishLink(node.id, "auto");
      } else {
        setLinkStart(null);
      }
      return;
    }

    onSelectNode?.(node);
    if (readOnly) return;
    draggingNodeRef.current = node.id;
    hasMovedNodeRef.current = false;

    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    dragOffsetRef.current = {
      x: canvasPos.x - node.x,
      y: canvasPos.y - node.y,
    };
  };

  // Drag & Drop from DevicePalette
  const handleDragOver = (e) => {
    e.preventDefault();
    if (!readOnly) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (readOnly) return;
    const rawData = e.dataTransfer.getData("application/nocr-topology-node");
    if (!rawData) return;

    try {
      const item = JSON.parse(rawData);

      if (item.is_live_nocr) {
        const existingNode = nodes.find(
          (n) =>
            isSameSite(n, {
              prefix: item.mapping_prefix,
              ruijie_mac: item.mapping_mac,
              site_name: item.label,
            }) && matchHardwareType(n, item.nocr_hw_type || item.type)
        );
        if (existingNode) {
          onSelectNode?.(existingNode);
          onNodeDragEnd?.();
          return;
        }
      }

      let { x, y } = screenToCanvas(e.clientX, e.clientY);

      x = x - 105;
      y = y - 43;

      if (snapToGrid) {
        x = Math.round(x / 20) * 20;
        y = Math.round(y / 20) * 20;
      }

      const newNode = {
        id: `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: item.type || "router",
        nocr_hw_type: item.nocr_hw_type,
        nocr_category: item.nocr_category,
        status_source: item.status_source,
        label: item.label || "Perangkat Baru",
        sublabel: item.sublabel || "",
        ip: item.ip || "",
        ports: item.ports || "",
        vendor: item.vendor || "",
        status: item.status || "online",
        mapping_prefix: item.mapping_prefix,
        mapping_mac: item.mapping_mac,
        is_live_nocr: item.is_live_nocr,
        x,
        y,
      };

      setNodes((prev) => [...prev, newNode]);
      onSelectNode?.(newNode);
      onNodeDragEnd?.();
    } catch (err) {
      console.error("Drop node error:", err);
    }
  };

  // Fit all nodes & areas into view
  const handleFitToScreen = () => {
    if (nodes.length === 0 && (!areas || areas.length === 0)) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    nodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + 210);
      maxY = Math.max(maxY, n.y + 86);
    });

    (areas || []).forEach((a) => {
      minX = Math.min(minX, a.x);
      minY = Math.min(minY, a.y);
      maxX = Math.max(maxX, a.x + a.width);
      maxY = Math.max(maxY, a.y + a.height);
    });

    const padding = 100;
    const boundingWidth = maxX - minX + padding * 2;
    const boundingHeight = maxY - minY + padding * 2;

    const scaleX = rect.width / boundingWidth;
    const scaleY = rect.height / boundingHeight;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.3), 1.5);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setZoom(newZoom);
    setPan({
      x: rect.width / 2 - centerX * newZoom,
      y: rect.height / 2 - centerY * newZoom,
    });
  };

  // Temporary Link Drawing Curve
  const tempLinkPath = (() => {
    if (!linkStart) return "";
    const startNode = nodes.find((n) => n.id === linkStart.nodeId);
    if (!startNode) return "";

    let startX = startNode.x + 105;
    let startY = startNode.y + 43;

    if (linkStart.port === "top") {
      startX = startNode.x + 105;
      startY = startNode.y;
    } else if (linkStart.port === "bottom") {
      startX = startNode.x + 105;
      startY = startNode.y + 86;
    } else if (linkStart.port === "left") {
      startX = startNode.x;
      startY = startNode.y + 43;
    } else if (linkStart.port === "right") {
      startX = startNode.x + 210;
      startY = startNode.y + 43;
    }

    const endX = mousePos.x;
    const endY = mousePos.y;

    const dx = endX - startX;
    const dy = endY - startY;
    const cx1 = startX + dx * 0.4;
    const cy1 = startY + dy * 0.1;
    const cx2 = startX + dx * 0.6;
    const cy2 = endY - dy * 0.1;

    return `M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`;
  })();

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative w-full h-full overflow-hidden select-none bg-[#0d1117] ${
        spacePressed ? "cursor-grab active:cursor-grabbing" : "cursor-default"
      }`}
    >
      {/* Grid Background Pattern */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <pattern
            id="canvas-grid-dots"
            width={24 * zoom}
            height={24 * zoom}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${pan.x}, ${pan.y})`}
          >
            <circle cx="2" cy="2" r="1.2" fill="#334155" opacity="0.65" />
          </pattern>

          <pattern
            id="canvas-grid-lines"
            width={40 * zoom}
            height={40 * zoom}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${pan.x}, ${pan.y})`}
          >
            <path d={`M ${40 * zoom} 0 L 0 0 0 ${40 * zoom}`} fill="none" stroke="#1e293b" strokeWidth="1" />
          </pattern>
        </defs>

        {gridStyle === "dots" && (
          <rect width="100%" height="100%" fill="url(#canvas-grid-dots)" />
        )}
        {gridStyle === "lines" && (
          <rect width="100%" height="100%" fill="url(#canvas-grid-lines)" />
        )}
      </svg>

      {/* Main Transform Container */}
      <div
        ref={canvasRef}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
        className="absolute inset-0 w-full h-full pointer-events-auto"
      >
        {/* 1. Render Area Boxes (Layer z-10 below nodes & cables) */}
        {(areas || []).map((area) => (
          <AreaBox
            key={area.id}
            area={area}
            containedCount={getContainedCount(area)}
            isHighlighted={highlightedAreaId === area.id}
            onStartDrag={handleStartDragArea}
            onStartResize={handleStartResizeArea}
            onUpdate={handleUpdateArea}
            onDelete={handleDeleteArea}
            readOnly={readOnly}
          />
        ))}

        {/* 2. Render Real-Time Right-Click Area Creation Draft */}
        {areaDraft && (
          <div
            style={{
              transform: `translate(${Math.min(areaDraft.startX, areaDraft.currentX)}px, ${Math.min(
                areaDraft.startY,
                areaDraft.currentY
              )}px)`,
              width: `${Math.abs(areaDraft.currentX - areaDraft.startX)}px`,
              height: `${Math.abs(areaDraft.currentY - areaDraft.startY)}px`,
            }}
            className="absolute top-0 left-0 border-2 border-dashed border-sky-400 bg-sky-500/15 rounded-2xl shadow-[0_0_25px_rgba(56,189,248,0.3)] pointer-events-none z-30 flex flex-col justify-between p-2.5 backdrop-blur-[1px] animate-pulse"
          >
            
            <div className="self-end bg-slate-900/90 border border-sky-400/60 rounded-lg px-2 py-0.5 text-[11px] font-mono font-bold text-sky-300 shadow-lg">
              {Math.round(Math.abs(areaDraft.currentX - areaDraft.startX))} ×{" "}
              {Math.round(Math.abs(areaDraft.currentY - areaDraft.startY))} px
            </div>
          </div>
        )}

        {/* 3. Render SVG Cables */}
        <PathRenderer
          links={links}
          nodes={nodes}
          selectedLinkId={selectedLinkId}
          onSelectLink={onSelectLink}
          simulationActive={simulationActive}
          simulationSpeed={simulationSpeed}
          showLabels={showLabels}
          onDeleteLink={canDelete && !readOnly ? onDeleteLink : null}
        />

        {/* 4. Temp Link Preview */}
        {!readOnly && tempLinkPath && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-30" style={{ overflow: "visible" }}>
            <path
              d={tempLinkPath}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeDasharray="6 6"
              className="animate-pulse"
            />
            <circle cx={mousePos.x} cy={mousePos.y} r="5" fill="#38bdf8" className="animate-ping" />
          </svg>
        )}

        {/* 5. Render Nodes Directly (Layer z-20) */}
        {nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            onSelect={onSelectNode}
            onMouseDown={(e) => handleNodeMouseDown(e, node)}
            onStartLink={handleStartLink}
            onFinishLink={handleFinishLink}
            onToggleStatus={!readOnly ? onToggleNodeStatus : null}
            onDelete={canDelete && !readOnly ? onDeleteNode : null}
            onDuplicate={!readOnly ? onDuplicateNode : null}
            isConnectingLink={!!linkStart}
            isLinkStart={linkStart?.nodeId === node.id}
            zoom={zoom}
            readOnly={readOnly}
            canDelete={canDelete}
            simulationActive={simulationActive}
          />
        ))}
      </div>

      {/* Top Right Zoom Controls */}
      <div
        data-export-ignore="true"
        className={`export-exclude absolute top-4 ${
          hasFloatingRight ? "right-52" : "right-4"
        } flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-xl p-1 shadow-2xl backdrop-blur-md z-30 transition-all duration-200`}
      >
        {setSimulationActive && (
          <button
            onClick={() => setSimulationActive((s) => !s)}
            title={simulationActive ? "Matikan Animasi Aliran Kabel" : "Nyalakan Animasi Aliran Kabel"}
            className={`cursor-pointer p-1.5 rounded-lg transition ${
              simulationActive
                ? "text-amber-400 hover:text-amber-300 hover:bg-slate-800"
                : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
            }`}
          >
            {simulationActive ? <Pause size={15} /> : <Play size={15} />}
          </button>
        )}

        <button
          onClick={() => setZoom((z) => Math.min(z + 0.15, 3.0))}
          title="Perbesar (Zoom In)"
          className="cursor-pointer text-slate-300 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg transition"
        >
          <ZoomIn size={15} />
        </button>

        <span className="text-[11px] font-mono font-bold text-slate-400 px-1 min-w-[40px] text-center">
          {Math.round(zoom * 100)}%
        </span>

        <button
          onClick={() => setZoom((z) => Math.max(z - 0.15, 0.25))}
          title="Perkecil (Zoom Out)"
          className="cursor-pointer text-slate-300 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg transition"
        >
          <ZoomOut size={15} />
        </button>

        <div className="w-px h-4 bg-slate-800" />

        <button
          onClick={handleFitToScreen}
          title="Pusatkan Semua Node & Area (Fit to View)"
          className="cursor-pointer text-slate-300 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg transition"
        >
          <Maximize2 size={15} />
        </button>

        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          title="Reset Posisi (100%)"
          className="cursor-pointer text-slate-300 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg transition"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Link Connecting Instruction Banner */}
      {linkStart && (
        <div
          data-export-ignore="true"
          className="export-exclude absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500/90 border border-amber-300 text-slate-950 px-4 py-1.5 rounded-full text-xs font-bold shadow-2xl flex items-center gap-2 z-40 animate-bounce"
        >
          <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
          <span>Klik node tujuan untuk menyambungkan kabel (Tekan Esc untuk batal)</span>
        </div>
      )}
    </div>
  );
}
