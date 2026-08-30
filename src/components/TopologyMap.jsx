"use client";
import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Tooltip,
  useMapEvents,
  useMap,
  ZoomControl,
} from "react-leaflet";

const DEFAULT_CENTER = [-7.065, 107.55];

// Helper menghitung jarak fisik kabel geografis (Haversine formula)
export function calculatePolylineDistance(positions = []) {
  if (!Array.isArray(positions) || positions.length < 2) return 0;
  let totalDistanceMeters = 0;
  for (let i = 0; i < positions.length - 1; i++) {
    const p1 = positions[i];
    const p2 = positions[i + 1];
    if (Array.isArray(p1) && Array.isArray(p2) && p1.length >= 2 && p2.length >= 2) {
      totalDistanceMeters += getDistanceMeters(p1[0], p1[1], p2[0], p2[1]);
    }
  }
  return totalDistanceMeters;
}

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius bumi dalam meter
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(meters) {
  if (!meters || isNaN(meters)) return "0 m";
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

// Helper mencari titik tengah geografis & sudut kemiringan kabel (midpoint & angle)
export function getSegmentAngleAndMidpoint(positions = []) {
  if (!Array.isArray(positions) || positions.length < 2) {
    return { midpoint: [-7.065, 107.55], angle: 0 };
  }
  
  if (positions.length === 2) {
    const p1 = positions[0];
    const p2 = positions[1];
    const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    const dy = p2[0] - p1[0];
    const dx = p2[1] - p1[1];
    let deg = (Math.atan2(-dy, dx) * 180) / Math.PI;
    if (deg > 90) deg -= 180;
    if (deg < -90) deg += 180;
    return { midpoint: mid, angle: deg };
  }

  const totalLength = calculatePolylineDistance(positions);
  const targetHalf = totalLength / 2;
  let accumulated = 0;

  for (let i = 0; i < positions.length - 1; i++) {
    const p1 = positions[i];
    const p2 = positions[i + 1];
    const segLen = getDistanceMeters(p1[0], p1[1], p2[0], p2[1]);
    if (accumulated + segLen >= targetHalf) {
      const remain = targetHalf - accumulated;
      const fraction = segLen > 0 ? remain / segLen : 0.5;
      const mid = [
        p1[0] + (p2[0] - p1[0]) * fraction,
        p1[1] + (p2[1] - p1[1]) * fraction,
      ];
      const dy = p2[0] - p1[0];
      const dx = p2[1] - p1[1];
      let deg = (Math.atan2(-dy, dx) * 180) / Math.PI;
      if (deg > 90) deg -= 180;
      if (deg < -90) deg += 180;
      return { midpoint: mid, angle: deg };
    }
    accumulated += segLen;
  }
  const midIdx = Math.floor(positions.length / 2);
  return { midpoint: positions[midIdx], angle: 0 };
}

// Helper finding closest segment to insert a new waypoint
function distanceToSegment(p, p1, p2) {
  const x = p.lat, y = p.lng;
  const x1 = p1[0], y1 = p1[1];
  const x2 = p2[0], y2 = p2[1];
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.hypot(x - x1, y - y1);
  }
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(x - projX, y - projY);
}

function findClosestSegmentIndex(point, positions) {
  if (positions.length <= 2) return 0;
  let minDist = Infinity;
  let bestSegment = 0;

  for (let i = 0; i < positions.length - 1; i++) {
    const p1 = positions[i];
    const p2 = positions[i + 1];
    const dist = distanceToSegment(point, p1, p2);
    if (dist < minDist) {
      minDist = dist;
      bestSegment = i;
    }
  }
  return bestSegment;
}

// Icon Waypoint Handle (Titik Belokan yang bisa digeser)
const getWaypointIcon = (index) => {
  return L.divIcon({
    className: "custom-waypoint-icon",
    html: `<div class="group relative flex items-center justify-center cursor-move">
      <div class="w-4 h-4 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_12px_#22d3ee] flex items-center justify-center transition-transform hover:scale-130 active:scale-95">
        <div class="w-1.5 h-1.5 rounded-full bg-slate-900"></div>
      </div>
      <div class="absolute -top-6 whitespace-nowrap text-[8px] font-bold text-cyan-200 bg-slate-950/95 px-1.5 py-0.5 rounded border border-cyan-500/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
        Belokan ${index + 1}
      </div>
    </div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

const getDraftWaypointIcon = (index) => {
  return L.divIcon({
    className: "custom-draft-waypoint-icon",
    html: `<div class="group relative flex items-center justify-center">
      <div class="w-4 h-4 rounded-full bg-amber-400 border-2 border-white shadow-[0_0_10px_#f59e0b] flex items-center justify-center animate-pulse">
        <div class="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
      </div>
      <div class="absolute -top-6 whitespace-nowrap text-[8px] font-bold text-amber-200 bg-slate-950/95 px-1.5 py-0.5 rounded border border-amber-500/50 shadow-lg">
        Titik ${index + 1}
      </div>
    </div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

// Komponen interaksi peta (Mendukung Pen Tool saat menggambar kabel FO)
function MapEvents({
  interactionMode,
  newNodeType,
  linkStartNode,
  onAddNode,
  onAddDraftWaypoint,
  onMouseMove,
  onSelectEmpty,
  onZoomChange,
  readOnly,
}) {
  const map = useMapEvents({
    click(e) {
      if (readOnly) {
        onSelectEmpty();
        return;
      }
      if (interactionMode === "add_node") {
        onAddNode(e.latlng.lat, e.latlng.lng, newNodeType);
      } else if (interactionMode === "add_edge" && linkStartNode) {
        // Klik pada background peta saat sedang menggambar kabel FO -> Tambahkan Titik Belokan
        onAddDraftWaypoint?.([e.latlng.lat, e.latlng.lng]);
      } else {
        onSelectEmpty();
      }
    },
    mousemove(e) {
      if (interactionMode === "add_edge" && linkStartNode) {
        onMouseMove?.([e.latlng.lat, e.latlng.lng]);
      }
    },
    zoomend() {
      if (onZoomChange) onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    if (onZoomChange && map) {
      onZoomChange(map.getZoom());
    }
  }, [map, onZoomChange]);

  return null;
}

// Komponen Custom Klik Kanan untuk Menggeser (Pan)
function RightClickPan() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    let isPanning = false;
    let startPoint;

    const onMouseDown = (e) => {
      if (e.originalEvent.button === 2) {
        // Klik Kanan
        isPanning = true;
        map.dragging.disable();
        startPoint = e.containerPoint;
        document.body.style.cursor = "grabbing";
      }
    };

    const onMouseMove = (e) => {
      if (isPanning) {
        const point = e.containerPoint;
        const offset = [startPoint.x - point.x, startPoint.y - point.y];
        map.panBy(offset, { animate: false });
        startPoint = point;
      }
    };

    const onMouseUp = (e) => {
      if (e.originalEvent.button === 2 && isPanning) {
        isPanning = false;
        map.dragging.enable();
        document.body.style.cursor = "";
      }
    };

    map.on("mousedown", onMouseDown);
    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);

    // Cegah menu konteks bawaan
    const contextMenuHandler = (e) => e.preventDefault();
    map.getContainer().addEventListener("contextmenu", contextMenuHandler);

    return () => {
      map.off("mousedown", onMouseDown);
      map.off("mousemove", onMouseMove);
      map.off("mouseup", onMouseUp);
      map.getContainer().removeEventListener("contextmenu", contextMenuHandler);
    };
  }, [map]);
  return null;
}

// Pengelola pintasan keyboard (Ctrl+Z untuk undo node drag, Escape/Backspace untuk Pen Tool waypoints)
function KeyboardHandler({ onUndo, onCancelDraftWaypoint, isDrafting }) {
  const map = useMap();
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (onUndo) onUndo();
      }
      if (isDrafting && (e.key === "Escape" || e.key === "Backspace")) {
        e.preventDefault();
        onCancelDraftWaypoint?.();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onUndo, onCancelDraftWaypoint, isDrafting]);
  return null;
}
function FlyToHandler({ flyToTarget, onFlyToComplete }) {
  const map = useMap();
  useEffect(() => {
    if (flyToTarget) {
      if (flyToTarget.bounds) {
        map.fitBounds(flyToTarget.bounds, {
          padding: [50, 50],
          maxZoom: 16,
          animate: true,
          duration: 1.5,
        });
      } else {
        map.flyTo([flyToTarget.lat, flyToTarget.lng], flyToTarget.zoom || 17, {
          duration: 1.5,
        });
      }

      const timer = setTimeout(() => {
        if (onFlyToComplete) onFlyToComplete();
      }, 1600);

      return () => clearTimeout(timer);
    }
  }, [flyToTarget, map, onFlyToComplete]);
  return null;
}

const getStaticMarkerIcon = (
  node,
  isSelected,
  isDown,
  isDisabled,
  isUp,
  currentZoom,
  showLabels,
) => {
  let colorClass = "bg-blue-500 border-blue-200";
  const t = node.type?.toLowerCase() || "";
  const isInfrastructure = ["olt", "odc", "odp", "core"].includes(t);
  let isOffline = false;

  if (isDisabled) colorClass = "bg-slate-500 border-slate-300";
  else if (isUp)
    colorClass = isInfrastructure
      ? "bg-blue-500 border-blue-300 ring-2 ring-blue-500/50"
      : "bg-emerald-500 border-emerald-300 ring-2 ring-emerald-500/50";
  else if (isDown) {
    colorClass = "bg-red-500 border-red-300 ring-2 ring-red-500/50";
    isOffline = true;
  } else {
    if (node.status === "online")
      colorClass = isInfrastructure
        ? "bg-blue-500 border-blue-300 ring-2 ring-blue-500/50"
        : "bg-emerald-500 border-emerald-300 ring-2 ring-emerald-500/50";
    else if (node.status === "offline") {
      colorClass = "bg-red-500 border-red-300 ring-2 ring-red-500/50";
      isOffline = true;
    } else if (t === "core" || t === "olt")
      colorClass = "bg-blue-600 border-blue-300";
    else if (t === "client") colorClass = "bg-purple-500 border-purple-200";
    else colorClass = "bg-slate-500 border-slate-300";
  }

  const isLabelActive =
    showLabels === true ||
    showLabels === "all" ||
    (showLabels === "offline" && isOffline);

  let scaleClass = "scale-60 hover:scale-[1.0]";
  let labelScale = "scale-60 mt-3";
  if (currentZoom >= 8) {
    scaleClass = "scale-100 hover:scale-150";
    labelScale = "scale-100 hover:scale-105 origin-top mt-1.5";
  } else if (currentZoom >= 11) {
    scaleClass = "scale-80 hover:scale-120";
    labelScale = "scale-80 hover:scale-100 origin-top mt-2.5";
  }

  let html = "";
  switch (t) {
    case "olt":
      html = `<div class="w-8 h-8 rounded-lg flex items-center justify-center border text-white shadow-lg ${colorClass}"><i class="fa-solid fa-server text-xs" style="color:#ffffff!important"></i></div>`;
      break;
    case "odc":
      html = `<div class="w-8 h-8 rounded-full flex items-center justify-center border text-white shadow-lg ${colorClass}"><i class="fa-solid fa-box text-xs" style="color:#ffffff!important"></i></div>`;
      break;
    case "odp":
      html = `<div class="w-8 h-8 rounded-full flex items-center justify-center border text-white shadow-lg ${colorClass}"><i class="fa-solid fa-network-wired text-xs" style="color:#ffffff!important"></i></div>`;
      break;
    case "client":
      html = `<div class="w-6 h-6 rounded-full flex items-center justify-center border text-white shadow-md ${colorClass}"><i class="fa-solid fa-home text-[10px]" style="color:#ffffff!important"></i></div>`;
      break;
    default:
      html = `<div class="w-6 h-6 rounded-full flex items-center justify-center border text-white shadow-md ${colorClass}"><i class="fa-solid fa-map-pin text-[10px]" style="color:#ffffff!important"></i></div>`;
  }

  return L.divIcon({
    className: "custom-leaflet-icon",
    html: `<div class="node-marker-wrapper relative transition-transform duration-200 flex flex-col items-center justify-center ${isSelected ? "scale-100 z-50" : scaleClass}">
        ${html}
        <div class="node-label absolute top-full whitespace-nowrap text-[9px] font-bold ${isOffline ? "text-red-200 bg-red-950/90 border-red-500/50" : "text-slate-200 bg-slate-900/80 border-slate-700/50"} px-1.5 py-0.5 rounded border pointer-events-none shadow-md mt-0.5 ${isLabelActive || isSelected ? "opacity-100" : "opacity-0"} transition-opacity duration-200">${node.label || "Tanpa Label"}</div>
      </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const DraggableMarker = React.memo(function DraggableMarker({
  node,
  isSelected,
  isDown,
  isDisabled,
  isUp,
  currentZoom,
  showLabels,
  interactionMode,
  readOnly,
  handleNodeClick,
  setNodes,
  pushUndo,
  setSelectedEdge,
  setSelectedNode,
  draggedNodeCoordRef,
}) {
  const [position, setPosition] = useState([
    parseFloat(node.latitude),
    parseFloat(node.longitude),
  ]);
  const isDragging = useRef(false);
  const nodeRef = useRef(node);
  const markerRef = useRef(null);

  useEffect(() => {
    nodeRef.current = node;
  }, [node]);

  useEffect(() => {
    if (!isDragging.current) {
      setPosition([parseFloat(node.latitude), parseFloat(node.longitude)]);
    }
  }, [node.latitude, node.longitude]);

  const icon = useMemo(() => {
    return getStaticMarkerIcon(
      node,
      isSelected,
      isDown,
      isDisabled,
      isUp,
      currentZoom,
      showLabels,
    );
  }, [
    node.type,
    node.status,
    node.label,
    node.linked_interface,
    isSelected,
    isDown,
    isDisabled,
    isUp,
    currentZoom,
    showLabels,
  ]);

  const handleDrag = useCallback(
    (e) => {
      if (readOnly) return;
      const marker = markerRef.current;
      if (!marker) return;

      const newLatLng = marker.getLatLng();
      const currentNodeId = nodeRef.current.id;
      const map = marker._map;

      if (map) {
        map.eachLayer((layer) => {
          if (layer instanceof L.Polyline && layer.options) {
            const { nodeFromId, nodeToId } = layer.options;
            if (nodeFromId === currentNodeId || nodeToId === currentNodeId) {
              const latlngs = layer.getLatLngs();
              if (latlngs.length >= 2) {
                if (nodeFromId === currentNodeId) latlngs[0] = newLatLng;
                if (nodeToId === currentNodeId)
                  latlngs[latlngs.length - 1] = newLatLng;
                layer.setLatLngs(latlngs);
                layer.redraw();
              }
            }
          }
        });
        if (draggedNodeCoordRef) {
          draggedNodeCoordRef.current[currentNodeId] = {
            lat: newLatLng.lat,
            lng: newLatLng.lng,
          };
        }
      }
    },
    [readOnly, draggedNodeCoordRef],
  );

  const eventHandlers = useMemo(
    () => ({
      click: (e) => handleNodeClick(e, nodeRef.current),
      mousedown: (e) => {
        if (e.originalEvent && e.originalEvent.button === 2) {
          L.DomEvent.stopPropagation(e.originalEvent || e);
        }
      },
      contextmenu: (e) => {
        if (e.originalEvent) {
          e.originalEvent.preventDefault();
          L.DomEvent.stopPropagation(e.originalEvent || e);
        }
        setSelectedEdge(null);
        setSelectedNode(nodeRef.current);
      },
      dragstart: () => {
        if (readOnly) return;
        isDragging.current = true;
        pushUndo(
          nodeRef.current.id,
          nodeRef.current.latitude,
          nodeRef.current.longitude,
        );
        if (draggedNodeCoordRef) {
          draggedNodeCoordRef.current[nodeRef.current.id] = {
            lat: nodeRef.current.latitude,
            lng: nodeRef.current.longitude,
          };
        }
      },
      drag: handleDrag,
      dragend: (e) => {
        if (readOnly) return;
        const newLatLng = e.target.getLatLng();
        const currentNodeId = nodeRef.current.id;

        setTimeout(() => {
          isDragging.current = false;
          if (draggedNodeCoordRef) {
            delete draggedNodeCoordRef.current[currentNodeId];
          }
        }, 50);

        setPosition([newLatLng.lat, newLatLng.lng]);
        setNodes((prev) =>
          prev.map((n) =>
            n.id === nodeRef.current.id
              ? { ...n, latitude: newLatLng.lat, longitude: newLatLng.lng }
              : n,
          ),
        );
      },
    }),
    [
      handleNodeClick,
      setNodes,
      pushUndo,
      setSelectedEdge,
      setSelectedNode,
      readOnly,
      handleDrag,
      draggedNodeCoordRef,
    ],
  );

  const typePriority = useMemo(() => {
    const t = node.type?.toLowerCase() || "";
    switch (t) {
      case "olt":
        return 800;
      case "core":
        return 600;
      case "client":
        return 200;
      case "odc":
        return -500;
      case "odp":
        return -600;
      default:
        return 0;
    }
  }, [node.type]);

  const zIndex = useMemo(() => {
    return (isSelected ? 9999 : 0) + (isDown ? 2000 : 0) + typePriority;
  }, [isSelected, isDown, typePriority]);

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={icon}
      draggable={!readOnly && interactionMode === "select"}
      eventHandlers={eventHandlers}
      zIndexOffset={zIndex}
    />
  );
});

const WaypointMarker = React.memo(function WaypointMarker({
  edgeId,
  waypointIndex,
  position,
  readOnly,
  onWaypointDrag,
  onWaypointDelete,
}) {
  const [pos, setPos] = useState(position);

  useEffect(() => {
    setPos(position);
  }, [position]);

  const icon = useMemo(() => getWaypointIcon(waypointIndex), [waypointIndex]);

  const eventHandlers = useMemo(
    () => ({
      drag: (e) => {
        if (readOnly) return;
        const newLatLng = e.target.getLatLng();
        setPos([newLatLng.lat, newLatLng.lng]);
        onWaypointDrag?.(edgeId, waypointIndex, [newLatLng.lat, newLatLng.lng]);
      },
      click: (e) => {
        L.DomEvent.stopPropagation(e.originalEvent || e);
      },
      contextmenu: (e) => {
        if (e.originalEvent) {
          e.originalEvent.preventDefault();
          L.DomEvent.stopPropagation(e.originalEvent || e);
        }
        if (!readOnly) {
          onWaypointDelete?.(edgeId, waypointIndex);
        }
      },
    }),
    [edgeId, waypointIndex, readOnly, onWaypointDrag, onWaypointDelete]
  );

  return (
    <Marker
      position={pos}
      icon={icon}
      draggable={!readOnly}
      eventHandlers={eventHandlers}
      zIndexOffset={10000}
    />
  );
});

const MemoizedEdge = React.memo(
  ({
    edge,
    isSelected,
    edgeColor,
    edgeDash,
    interactionMode,
    readOnly,
    onEdgeDelete,
    onEdgeClick,
  }) => {
    const distanceMeters = useMemo(
      () => calculatePolylineDistance(edge.positions),
      [edge.positions]
    );

    const { midpoint, angle } = useMemo(
      () => getSegmentAngleAndMidpoint(edge.positions),
      [edge.positions]
    );

    const distanceIcon = useMemo(() => {
      const formatted = formatDistance(distanceMeters);
      return L.divIcon({
        className: "custom-distance-badge-icon",
        html: `<div style="transform: translate(-50%, -50%) rotate(${angle}deg);" class="px-2 py-0.5 rounded bg-slate-950/95 border border-cyan-400 text-cyan-300 font-mono font-bold text-xs shadow-xl whitespace-nowrap pointer-events-none select-none tracking-tight">
          ${formatted}
        </div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
    }, [distanceMeters, angle]);

    const handleClick = useCallback(
      (e) => {
        if (e.originalEvent) {
          L.DomEvent.stop(e.originalEvent);
        }
        onEdgeClick?.(e, edge);
      },
      [edge, onEdgeClick]
    );

    return (
      <React.Fragment>
        {/* Area klik transparan selebar 40px agar sangat mudah diklik */}
        <Polyline
          positions={edge.positions}
          pathOptions={{
            color: "#ffffff",
            weight: 40,
            opacity: 0.001,
            className: "cursor-pointer",
          }}
          eventHandlers={{
            click: handleClick,
          }}
        />

        {/* Garis kabel visual utama */}
        <Polyline
          positions={edge.positions}
          pathOptions={{
            color: isSelected ? "#38bdf8" : edgeColor,
            weight: isSelected ? 6 : 3.5,
            dashArray: edgeDash,
            opacity: isSelected ? 1.0 : 0.85,
            nodeFromId: edge.from_node || edge.from,
            nodeToId: edge.to_node || edge.to,
            className: "cursor-pointer",
          }}
          eventHandlers={{
            click: handleClick,
          }}
        />

        {/* Badge Jarak di tengah kabel menempel sesuai kemiringan kabel hanya saat kabel diklik/dipilih */}
        {isSelected && (
          <Marker
            position={midpoint}
            icon={distanceIcon}
            zIndexOffset={30000}
            interactive={false}
          />
        )}
      </React.Fragment>
    );
  },
);

export default function TopologyMap({
  center = DEFAULT_CENTER,
  zoom = 11,
  mapTheme = "dark",
  showLabels = false,
  nodes,
  edges,
  mappings = [],
  interactionMode,
  newNodeType,
  selectedNode,
  selectedEdge,
  coreInterfaces,
  linkStartNode,
  handleAddNode,
  handleNodeClick,
  setNodes,
  setEdges,
  setSelectedNode,
  setSelectedEdge,
  setLinkStartNode,
  flyToTarget,
  onFlyToComplete,
  onEdgeDelete,
  readOnly = false,
}) {
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const undoStackRef = useRef([]); // [{id, lat, lng}]
  const draggedNodeCoordRef = useRef({}); // { [nodeId]: { lat, lng } }

  // Pen Tool Draft Waypoints State
  const [draftWaypoints, setDraftWaypoints] = useState([]);
  const [mouseCursorPos, setMouseCursorPos] = useState(null);

  useEffect(() => {
    if (!linkStartNode) {
      setDraftWaypoints([]);
      setMouseCursorPos(null);
    }
  }, [linkStartNode]);

  const handleAddDraftWaypoint = useCallback((latlng) => {
    setDraftWaypoints((prev) => [...prev, latlng]);
  }, []);

  const handleCancelDraftWaypoint = useCallback(() => {
    setDraftWaypoints((prev) => {
      if (prev.length > 0) return prev.slice(0, -1);
      setLinkStartNode?.(null);
      return [];
    });
  }, [setLinkStartNode]);

  const handleWaypointDrag = useCallback((edgeId, index, newLatLng) => {
    setEdges((prev) =>
      prev.map((ed) => {
        if (ed.id === edgeId) {
          const newWaypoints = [...(ed.waypoints || [])];
          newWaypoints[index] = newLatLng;
          return { ...ed, waypoints: newWaypoints };
        }
        return ed;
      })
    );
    setSelectedEdge((prev) => {
      if (prev && prev.id === edgeId) {
        const newWaypoints = [...(prev.waypoints || [])];
        newWaypoints[index] = newLatLng;
        return { ...prev, waypoints: newWaypoints };
      }
      return prev;
    });
  }, [setEdges, setSelectedEdge]);

  const handleWaypointDelete = useCallback((edgeId, index) => {
    setEdges((prev) =>
      prev.map((ed) => {
        if (ed.id === edgeId) {
          const newWaypoints = (ed.waypoints || []).filter((_, i) => i !== index);
          return { ...ed, waypoints: newWaypoints };
        }
        return ed;
      })
    );
    setSelectedEdge((prev) => {
      if (prev && prev.id === edgeId) {
        const newWaypoints = (prev.waypoints || []).filter((_, i) => i !== index);
        return { ...prev, waypoints: newWaypoints };
      }
      return prev;
    });
  }, [setEdges, setSelectedEdge]);

  const handleEdgeClick = useCallback((e, edge) => {
    if (!readOnly && interactionMode === "delete_edge") {
      onEdgeDelete?.(edge.id);
      setEdges((prev) => prev.filter((ed) => ed.id !== edge.id));
      if (selectedEdge && (selectedEdge.id === edge.id || String(selectedEdge.id) === String(edge.id))) {
        setSelectedEdge(null);
      }
      return;
    }

    const isCurrentEdgeSelected = Boolean(
      selectedEdge && (selectedEdge.id === edge.id || String(selectedEdge.id) === String(edge.id))
    );

    if (isCurrentEdgeSelected && !readOnly && interactionMode === "select") {
      // Pen Tool: Klik pada polyline yang sudah dipilih untuk menyisipkan titik belokan baru
      const clickLatLng = [e.latlng.lat, e.latlng.lng];
      const segIdx = findClosestSegmentIndex(e.latlng, edge.positions);
      const currentWaypoints = [...(edge.waypoints || [])];
      currentWaypoints.splice(segIdx, 0, clickLatLng);

      const updatedEdge = { ...edge, waypoints: currentWaypoints };
      setEdges((prev) =>
        prev.map((ed) => (ed.id === edge.id ? { ...ed, waypoints: currentWaypoints } : ed))
      );
      setSelectedEdge(updatedEdge);
    } else {
      setSelectedNode(null);
      setSelectedEdge(edge);
    }
  }, [readOnly, interactionMode, onEdgeDelete, selectedEdge, setEdges, setSelectedEdge, setSelectedNode]);

  const pushUndo = useCallback((id, lat, lng) => {
    undoStackRef.current.push({ id, lat, lng });
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
  }, []);

  const handleUndo = useCallback(() => {
    const last = undoStackRef.current.pop();
    if (!last) return;
    setNodes((prev) =>
      prev.map((n) =>
        n.id === last.id
          ? { ...n, latitude: last.lat, longitude: last.lng }
          : n,
      ),
    );
  }, [setNodes]);

  // Fungsi pembantu untuk menentukan status edge mempertimbangkan mappings (final_status) dan coreInterfaces
  const getInterfaceStatus = (ifaceName) => {
    if (!ifaceName) return null;
    const lowerName = ifaceName.toLowerCase();

    const m = mappings || [];
    const mappedNode = m.find(
      (map) => map.prefix && map.prefix.toLowerCase() === lowerName,
    );
    if (mappedNode) {
      if (mappedNode.final_status === "Offline") return "down";
      if (mappedNode.final_status === "Online") return "up";
    }

    const matched = coreInterfaces.find(
      (i) => i.name && i.name.toLowerCase() === lowerName,
    );
    if (matched) {
      if (matched.disabled === "true") return "disabled";
      if (matched.running === "true") return "up";
      return "down";
    }
    return null;
  };

  const getEdgeDerivedStatus = (edge) => {
    let status = getInterfaceStatus(edge.label);
    if (status) return status;
    status = getInterfaceStatus(edge.toNode?.linked_interface);
    if (status) return status;
    status = getInterfaceStatus(edge.fromNode?.linked_interface);
    if (status) return status;
    return edge.status === "down" ? "down" : "up";
  };

  // Warna edge berdasarkan status: Disabled=abu-abu, Up=hijau/biru, Down=merah
  const getEdgeColor = (edge) => {
    if (selectedEdge?.id === edge.id) return "#38bdf8"; // biru terang menyala saat dipilih

    const status = getEdgeDerivedStatus(edge);
    const isInfrastructure =
      edge.fromNode?.type?.toLowerCase() !== "client" &&
      edge.toNode?.type?.toLowerCase() !== "client";

    if (status === "disabled") return "#475569"; // slate-600
    if (status === "down") return "#ef4444"; // red-500
    return isInfrastructure ? "#3b82f6" : "#22c55e"; // blue-500 or green-500
  };

  const getEdgeDash = (edge) => {
    const status = getEdgeDerivedStatus(edge);
    const isInfrastructure =
      edge.fromNode?.type?.toLowerCase() !== "client" &&
      edge.toNode?.type?.toLowerCase() !== "client";

    if (status === "disabled") return "4, 8";
    if (status === "down") return "6, 6";
    return isInfrastructure ? "8, 8" : null;
  };

  const validEdges = useMemo(() => {
    return edges
      .map((edge) => {
        const fromNode = nodes.find(
          (n) => n.id === edge.from_node || n.id === edge.from,
        );
        const toNode = nodes.find(
          (n) => n.id === edge.to_node || n.id === edge.to,
        );
        if (!fromNode || !toNode) return null;
        if (isNaN(fromNode.latitude) || isNaN(toNode.latitude)) return null;

        let fLat = fromNode.latitude,
          fLng = fromNode.longitude;
        let tLat = toNode.latitude,
          tLng = toNode.longitude;

        if (draggedNodeCoordRef.current[fromNode.id]) {
          fLat = draggedNodeCoordRef.current[fromNode.id].lat;
          fLng = draggedNodeCoordRef.current[fromNode.id].lng;
        }
        if (draggedNodeCoordRef.current[toNode.id]) {
          tLat = draggedNodeCoordRef.current[toNode.id].lat;
          tLng = draggedNodeCoordRef.current[toNode.id].lng;
        }

        let waypoints = edge.waypoints || [];
        if (typeof waypoints === "string") {
          try {
            waypoints = JSON.parse(waypoints);
          } catch {
            waypoints = [];
          }
        }
        if (!Array.isArray(waypoints)) waypoints = [];

        const validWaypoints = waypoints.filter(
          (pt) => Array.isArray(pt) && pt.length >= 2 && !isNaN(pt[0]) && !isNaN(pt[1])
        );

        return {
          ...edge,
          fromNode: { ...fromNode, latitude: fLat, longitude: fLng },
          toNode: { ...toNode, latitude: tLat, longitude: tLng },
          waypoints: validWaypoints,
          positions: [
            [fLat, fLng],
            ...validWaypoints,
            [tLat, tLng],
          ],
        };
      })
      .filter(Boolean);
  }, [edges, nodes]);

  // Draft polyline saat mode pen tool menggambar kabel FO baru
  const draftStartNode = useMemo(() => {
    if (!linkStartNode) return null;
    return nodes.find((n) => n.id === linkStartNode) || null;
  }, [linkStartNode, nodes]);

  const draftPolylinePositions = useMemo(() => {
    if (!draftStartNode || isNaN(draftStartNode.latitude) || isNaN(draftStartNode.longitude)) return null;
    const startCoord = [draftStartNode.latitude, draftStartNode.longitude];
    const points = [startCoord, ...draftWaypoints];
    if (mouseCursorPos) points.push(mouseCursorPos);
    return points;
  }, [draftStartNode, draftWaypoints, mouseCursorPos]);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      maxZoom={22}
      zoomControl={false}
      scrollWheelZoom={true}
      className={`w-full h-full z-0 outline-none ${interactionMode === "add_edge" && linkStartNode ? "cursor-crosshair" : ""}`}
      fadeAnimation={true}
      markerZoomAnimation={true}
    >
      <TileLayer
        key={mapTheme}
        attribution={
          mapTheme === "colored"
            ? "&copy; Google Maps"
            : '&copy; <a href="https://carto.com/attributions">CARTO</a>'
        }
        url={
          mapTheme === "colored"
            ? "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        }
        maxZoom={22}
        maxNativeZoom={mapTheme === "colored" ? 21 : 19}
        keepBuffer={4}
        className={mapTheme === "colored" ? "" : "map-tiles-carto-dark"}
      />
      <ZoomControl position="bottomright" />
      <style jsx global>{`
        .leaflet-bottom.leaflet-right .leaflet-control-zoom {
          margin-bottom: 72px !important;
          margin-right: 24px !important;
          border-radius: 12px !important;
          overflow: hidden !important;
          border: 1px solid rgba(51, 65, 85, 0.8) !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6) !important;
          background: rgba(15, 23, 42, 0.9) !important;
          backdrop-filter: blur(8px) !important;
        }
        .leaflet-bottom.leaflet-right .leaflet-control-zoom a {
          background: rgba(15, 23, 42, 0.9) !important;
          color: #e2e8f0 !important;
          border-bottom: 1px solid rgba(51, 65, 85, 0.6) !important;
          width: 32px !important;
          height: 32px !important;
          line-height: 32px !important;
          font-size: 16px !important;
          font-weight: bold !important;
          transition: all 0.15s ease !important;
        }
        .leaflet-bottom.leaflet-right .leaflet-control-zoom a:hover:not(.leaflet-disabled) {
          background: #1e293b !important;
          color: #38bdf8 !important;
        }
        .leaflet-bottom.leaflet-right .leaflet-control-zoom a.leaflet-disabled,
        .leaflet-control-zoom-in.leaflet-disabled,
        .leaflet-control-zoom-out.leaflet-disabled {
          background: rgba(15, 23, 42, 0.5) !important;
          color: #475569 !important;
          cursor: not-allowed !important;
          pointer-events: none !important;
          opacity: 0.3 !important;
        }
        .custom-edge-distance-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .custom-edge-distance-tooltip::before {
          display: none !important;
        }
      `}</style>
      <MapEvents
        interactionMode={interactionMode}
        newNodeType={newNodeType}
        linkStartNode={linkStartNode}
        onAddNode={handleAddNode}
        onAddDraftWaypoint={handleAddDraftWaypoint}
        onMouseMove={setMouseCursorPos}
        onSelectEmpty={() => {
          setSelectedNode(null);
          setSelectedEdge(null);
        }}
        onZoomChange={setCurrentZoom}
        readOnly={readOnly}
      />
      <RightClickPan />
      <FlyToHandler
        flyToTarget={flyToTarget}
        onFlyToComplete={onFlyToComplete}
      />
      {!readOnly && (
        <KeyboardHandler
          onUndo={handleUndo}
          onCancelDraftWaypoint={handleCancelDraftWaypoint}
          isDrafting={!!linkStartNode}
        />
      )}

      {/* Render Valid Edges */}
      {validEdges.map((edge) => (
        <MemoizedEdge
          key={edge.id}
          edge={edge}
          isSelected={Boolean(selectedEdge && (selectedEdge.id === edge.id || String(selectedEdge.id) === String(edge.id)))}
          edgeColor={getEdgeColor(edge)}
          edgeDash={getEdgeDash(edge)}
          interactionMode={interactionMode}
          readOnly={readOnly}
          onEdgeDelete={onEdgeDelete}
          onEdgeClick={handleEdgeClick}
        />
      ))}

      {/* Draft Polyline & Waypoints saat Pen Tool aktif (Clean line without middle box) */}
      {draftPolylinePositions && draftPolylinePositions.length >= 2 && (
        <Polyline
          positions={draftPolylinePositions}
          pathOptions={{
            color: "#f59e0b",
            weight: 3.5,
            dashArray: "6, 6",
            opacity: 0.95,
          }}
        />
      )}
      {draftWaypoints.map((pt, idx) => (
        <Marker
          key={`draft-wp-${idx}`}
          position={pt}
          icon={getDraftWaypointIcon(idx)}
          zIndexOffset={10001}
        />
      ))}

      {/* Waypoint Handles untuk Edge yang sedang dipilih (Bisa digeser untuk belokan jalan) */}
      {selectedEdge && Array.isArray(selectedEdge.waypoints) && (
        selectedEdge.waypoints.map((wp, idx) => (
          <WaypointMarker
            key={`wp-${selectedEdge.id}-${idx}`}
            edgeId={selectedEdge.id}
            waypointIndex={idx}
            position={wp}
            readOnly={readOnly}
            onWaypointDrag={handleWaypointDrag}
            onWaypointDelete={handleWaypointDelete}
          />
        ))
      )}

      {/* Render Node Markers */}
      {nodes
        .filter(
          (n) =>
            !isNaN(parseFloat(n.latitude)) && !isNaN(parseFloat(n.longitude)),
        )
        .map((node) => {
          let isDown = false,
            isDisabled = false,
            isUp = false;
          if (node.linked_interface) {
            const linkedPrefix = node.linked_interface.toLowerCase();
            const m = mappings || [];
            const mappedNode = m.find(
              (map) => map.prefix && map.prefix.toLowerCase() === linkedPrefix,
            );
            if (mappedNode) {
              if (mappedNode.final_status === "Offline") isDown = true;
              else if (mappedNode.final_status === "Online") isUp = true;
            } else {
              const matchedIface = (coreInterfaces || []).find(
                (i) => i.name && i.name.toLowerCase() === linkedPrefix,
              );
              if (matchedIface) {
                if (matchedIface.disabled === "true") isDisabled = true;
                else if (matchedIface.running === "true") isUp = true;
                else isDown = true;
              }
            }
          } else if (node.type?.toLowerCase() !== "core") {
            const connectedEdges = edges.filter(
              (e) =>
                e.from_node === node.id ||
                e.to_node === node.id ||
                e.from === node.id ||
                e.to === node.id,
            );
            if (connectedEdges.length === 0) isDisabled = true;
            else isUp = true;
          } else {
            isDown = node.status === "offline";
          }

          return (
            <DraggableMarker
              key={node.id}
              node={node}
              isSelected={selectedNode?.id === node.id}
              isDown={isDown}
              isDisabled={isDisabled}
              isUp={isUp}
              currentZoom={currentZoom}
              showLabels={showLabels}
              interactionMode={interactionMode}
              readOnly={readOnly}
              handleNodeClick={(e, n) => handleNodeClick(e, n, draftWaypoints)}
              setNodes={setNodes}
              pushUndo={pushUndo}
              setSelectedEdge={setSelectedEdge}
              setSelectedNode={setSelectedNode}
              draggedNodeCoordRef={draggedNodeCoordRef}
            />
          );
        })}
    </MapContainer>
  );
}
