'use client';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet';

const DEFAULT_CENTER = [-7.065, 107.55];;

// Map interaction component
function MapEvents({ interactionMode, newNodeType, onAddNode, onSelectEmpty, onZoomChange, readOnly }) {
  const map = useMapEvents({
    click(e) {
      if (readOnly) {
        onSelectEmpty();
        return;
      }
      if (interactionMode === 'add_node') {
        onAddNode(e.latlng.lat, e.latlng.lng, newNodeType);
      } else {
        onSelectEmpty();
      }
    },
    zoomend() {
      if (onZoomChange) onZoomChange(map.getZoom());
    }
  });

  useEffect(() => {
    if (onZoomChange && map) {
      onZoomChange(map.getZoom());
    }
  }, [map, onZoomChange]);

  return null;
}

// Custom Right-Click to Pan Component
function RightClickPan() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    let isPanning = false;
    let startPoint;
    
    const onMouseDown = (e) => {
      if (e.originalEvent.button === 2) { // Right click
        isPanning = true;
        map.dragging.disable();
        startPoint = e.containerPoint;
        document.body.style.cursor = 'grabbing';
      }
    };
    
    const onMouseMove = (e) => {
      if (isPanning) {
        const point = e.containerPoint;
        const offset = [startPoint.x - point.x, startPoint.y - point.y];
        map.panBy(offset, {animate: false});
        startPoint = point;
      }
    };
    
    const onMouseUp = (e) => {
      if (e.originalEvent.button === 2 && isPanning) {
        isPanning = false;
        map.dragging.enable();
        document.body.style.cursor = '';
      }
    };

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);
    
    // Prevent default context menu
    const contextMenuHandler = (e) => e.preventDefault();
    map.getContainer().addEventListener('contextmenu', contextMenuHandler);

    return () => {
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
      map.getContainer().removeEventListener('contextmenu', contextMenuHandler);
    };
  }, [map]);
  return null;
}

// Keyboard shortcut handler (Ctrl+Z to undo last node drag)
function KeyboardHandler({ onUndo }) {
  const map = useMap();
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (onUndo) onUndo();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onUndo]);
  return null;
}
function FlyToHandler({ flyToTarget, onFlyToComplete }) {
  const map = useMap();
  useEffect(() => {
    if (flyToTarget) {
      map.flyTo([flyToTarget.lat, flyToTarget.lng], flyToTarget.zoom || 17, { duration: 1.5 });
      if (onFlyToComplete) onFlyToComplete();
    }
  }, [flyToTarget]);
  return null;
}

function DraggableMarker({ node, isSelected, getMarkerIcon, edges, coreInterfaces, showLabels, interactionMode, readOnly, handleNodeClick, setNodes, pushUndo, setSelectedEdge, setSelectedNode }) {
  const [position, setPosition] = useState([parseFloat(node.latitude), parseFloat(node.longitude)]);
  const isDragging = useRef(false);
  const nodeRef = useRef(node);
  const markerRef = useRef(null);

  // Efek ini hanya mengupdate posisi jika pengguna TIDAK sedang menyeret ikon
  useEffect(() => {
    nodeRef.current = node;
    if (!isDragging.current) {
      setPosition([parseFloat(node.latitude), parseFloat(node.longitude)]);
    }
  }, [node]);

  const icon = useMemo(() => {
    return getMarkerIcon(node, isSelected, edges, showLabels);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.type, node.status, node.label, node.linked_interface, isSelected, edges, coreInterfaces, showLabels]);

  // Handler seret interaktif yang mengunci pergerakan kabel secara simultan
  const handleDrag = useCallback((e) => {
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
              if (nodeFromId === currentNodeId) {
                latlngs[0] = newLatLng;
              }
              if (nodeToId === currentNodeId) {
                latlngs[latlngs.length - 1] = newLatLng;
              }
              layer.setLatLngs(latlngs);
              layer.redraw(); // Paksa render ulang instan untuk layer kabel ini saja
            }
          }
        }
      });
    }
  }, [readOnly]);

  const eventHandlers = useMemo(() => ({
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
      isDragging.current = true; // Kunci status menyeret menjadi TRUE
      pushUndo(nodeRef.current.id, nodeRef.current.latitude, nodeRef.current.longitude);
    },
    drag: handleDrag,
    dragend: (e) => {
      if (readOnly) return;
      const newLatLng = e.target.getLatLng();
      
      // Berikan jeda mikro agar Leaflet menyelesaikan animasi internal sebelum status kunci dibuka
      setTimeout(() => {
        isDragging.current = false;
      }, 50);

      setPosition([newLatLng.lat, newLatLng.lng]);
      
      // Kirim koordinat mutakhir ke state penampung utama di page.jsx
      setNodes(prev => prev.map(n => 
        n.id === nodeRef.current.id 
          ? { ...n, latitude: newLatLng.lat, longitude: newLatLng.lng } 
          : n
      ));
    }
  }), [handleNodeClick, setNodes, pushUndo, setSelectedEdge, setSelectedNode, readOnly, handleDrag]);

  const isDown = useMemo(() => {
    const interfaces = coreInterfaces || [];
    if (node.linked_interface) {
      const matchedIface = interfaces.find(i => i.name && i.name.toLowerCase() === node.linked_interface.toLowerCase());
      if (matchedIface) {
        return matchedIface.disabled !== 'true' && matchedIface.running !== 'true';
      }
    } else if (node.type?.toLowerCase() !== 'core') {
      const connectedEdges = edges.filter(e => e.from_node === node.id || e.to_node === node.id || e.from === node.id || e.to === node.id);
      if (connectedEdges.length === 0) {
        return false;
      }
    }
    return node.status === 'offline';
  }, [node.linked_interface, node.type, node.status, node.id, edges, coreInterfaces]);

  const typePriority = useMemo(() => {
    const t = node.type?.toLowerCase() || '';
    switch (t) {
      case 'olt': return 800;
      case 'core': return 600;
      case 'client': return 200;
      case 'pole': return 100;
      case 'odc': return -500;
      case 'odp': return -600;
      default: return 0;
    }
  }, [node.type]);

  const zIndex = useMemo(() => {
    return (isSelected ? 5000 : 0) + (isDown ? 2000 : 0) + typePriority;
  }, [isSelected, isDown, typePriority]);

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={icon}
      draggable={!readOnly && interactionMode === 'select'}
      eventHandlers={eventHandlers}
      zIndexOffset={zIndex}
    />
  );
}

export default function TopologyMap({
  mapTheme = 'dark',
  showLabels = false,
  nodes,
  edges,
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
  const [currentZoom, setCurrentZoom] = useState(11);
  const undoStackRef = useRef([]); // [{id, lat, lng}]

  const pushUndo = useCallback((id, lat, lng) => {
    undoStackRef.current.push({ id, lat, lng });
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
  }, []);

  const handleUndo = useCallback(() => {
    const last = undoStackRef.current.pop();
    if (!last) return;
    setNodes(prev => prev.map(n => n.id === last.id ? { ...n, latitude: last.lat, longitude: last.lng } : n));
  }, [setNodes]);

  // Helper to find interface matching edge label or connected nodes' linked_interface
  const findMatchingInterface = (edge) => {
    let matched = coreInterfaces.find(i => i.name && edge.label && i.name.toLowerCase() === edge.label.toLowerCase());
    if (matched) return matched;
    
    if (edge.toNode?.linked_interface) {
      matched = coreInterfaces.find(i => i.name && i.name.toLowerCase() === edge.toNode.linked_interface.toLowerCase());
      if (matched) return matched;
    }
    if (edge.fromNode?.linked_interface) {
      matched = coreInterfaces.find(i => i.name && i.name.toLowerCase() === edge.fromNode.linked_interface.toLowerCase());
      if (matched) return matched;
    }
    return null;
  };

  // Edge colors based on interface status: Disabled=gray, Up=green/blue, Down=red
  const getEdgeColor = (edge) => {
    if (selectedEdge?.id === edge.id) return '#93c5fd'; // lighter blue when selected to distinguish from infra links

    const matchedIface = findMatchingInterface(edge);
    const isInfrastructure = edge.fromNode?.type?.toLowerCase() !== 'client' && edge.toNode?.type?.toLowerCase() !== 'client';

    if (matchedIface) {
      if (matchedIface.disabled === 'true') return '#475569'; // slate-600 = disabled
      if (matchedIface.running === 'true') return isInfrastructure ? '#3b82f6' : '#22c55e';  // blue-500 if infra, green-500 if client
      return '#ef4444'; // red-500 = DOWN
    }

    if (edge.status === 'down') return '#ef4444';
    return isInfrastructure ? '#3b82f6' : '#22c55e';
  };

  const getEdgeDash = (edge) => {
    const matchedIface = findMatchingInterface(edge);
    const isInfrastructure = edge.fromNode?.type?.toLowerCase() !== 'client' && edge.toNode?.type?.toLowerCase() !== 'client';
    
    if (matchedIface?.disabled === 'true') return '4, 8';
    if (matchedIface && matchedIface.running !== 'true') return '6, 6';
    if (edge.status === 'down') return '6, 6';
    return isInfrastructure ? '8, 8' : null;
  };

  const validEdges = useMemo(() => {
    return edges.map(edge => {
      const fromNode = nodes.find(n => n.id === edge.from_node || n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to_node || n.id === edge.to);
      if (!fromNode || !toNode) return null;
      if (isNaN(fromNode.latitude) || isNaN(toNode.latitude)) return null;
      return { ...edge, fromNode, toNode };
    }).filter(Boolean);
  }, [edges, nodes]);

  const getMarkerIcon = (node, isSelected, currentEdges = [], labelsVisible = false) => {
    let colorClass = 'bg-blue-500 border-blue-200';
    let isDown = false;
    let isDisabled = false;
    let isUp = false;

    if (node.linked_interface) {
        const matchedIface = coreInterfaces.find(i => i.name && i.name.toLowerCase() === node.linked_interface.toLowerCase());
        if (matchedIface) {
            if (matchedIface.disabled === 'true') isDisabled = true;
            else if (matchedIface.running === 'true') isUp = true;
            else isDown = true;
        }
    } else if (node.type?.toLowerCase() !== 'core') {
        const connectedEdges = currentEdges.filter(e => e.from_node === node.id || e.to_node === node.id || e.from === node.id || e.to === node.id);
        if (connectedEdges.length === 0) {
            isDisabled = true;
        } else {
            isUp = true;
        }
    }

    const t = node.type?.toLowerCase() || '';
    const isInfrastructure = ['olt', 'odc', 'odp', 'core', 'pole'].includes(t);

    if (isDisabled) colorClass = 'bg-slate-500 border-slate-300';
    else if (isUp) colorClass = isInfrastructure ? 'bg-blue-500 border-blue-300 ring-2 ring-blue-500/50' : 'bg-emerald-500 border-emerald-300 ring-2 ring-emerald-500/50';
    else if (isDown) colorClass = 'bg-red-500 border-red-300 ring-2 ring-red-500/50';
    else {
        if (node.status === 'online') colorClass = isInfrastructure ? 'bg-blue-500 border-blue-300 ring-2 ring-blue-500/50' : 'bg-emerald-500 border-emerald-300 ring-2 ring-emerald-500/50';
        else if (node.status === 'offline') colorClass = 'bg-red-500 border-red-300 ring-2 ring-red-500/50';
        else if (t === 'core' || t === 'olt') colorClass = 'bg-blue-600 border-blue-300';
        else if (t === 'client') colorClass = 'bg-purple-500 border-purple-200';
        else colorClass = 'bg-slate-500 border-slate-300';
    }

    // Semakin di-zoom, marker semakin besar
    let scaleClass = 'scale-60 hover:scale-[1.0]';
    let labelScale = 'scale-60 mt-3';
    if (currentZoom >= 8) {
      scaleClass = 'scale-100 hover:scale-150';
      labelScale = 'scale-100 hover:scale-105 origin-top mt-1.5';
    } else if (currentZoom >= 11) {
      scaleClass = 'scale-80 hover:scale-120';
      labelScale = 'scale-80 hover:scale-100 origin-top mt-2.5';
    }

    let html = '';
    switch (t) {
      case 'olt': html = `<div class="w-8 h-8 rounded-lg flex items-center justify-center border text-white shadow-lg ${colorClass}"><i class="fa-solid fa-server text-xs"></i></div>`; break;
      case 'odc': html = `<div class="w-8 h-8 rounded-full flex items-center justify-center border text-white shadow-lg ${colorClass}"><i class="fa-solid fa-box text-xs"></i></div>`; break;
      case 'odp': html = `<div class="w-8 h-8 rounded-full flex items-center justify-center border text-white shadow-lg ${colorClass}"><i class="fa-solid fa-network-wired text-xs"></i></div>`; break;
      case 'pole': html = `<div class="w-7 h-7 rounded-sm flex items-center justify-center border text-white shadow-md ${colorClass}"><i class="fa-solid fa-grip-lines-vertical text-[10px]"></i></div>`; break;
      case 'client': html = `<div class="w-6 h-6 rounded-full flex items-center justify-center border text-white shadow-md ${colorClass}"><i class="fa-solid fa-home text-[10px]"></i></div>`; break;
      default: html = `<div class="w-6 h-6 rounded-full flex items-center justify-center border text-white shadow-md ${colorClass}"><i class="fa-solid fa-map-pin text-[10px]"></i></div>`;
    }

    return L.divIcon({
      className: 'custom-leaflet-icon',
      html: `<div class="node-marker-wrapper relative transition-transform duration-200 flex flex-col items-center justify-center ${isSelected ? 'scale-100 z-50' : scaleClass}">
        ${html}
        <div class="node-label absolute top-full whitespace-nowrap text-[9px] font-bold text-slate-200 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-700/50 pointer-events-none shadow-md mt-0.5 ${labelsVisible ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200">${node.label || 'Tanpa Label'}</div>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  };

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={11}
      scrollWheelZoom={true}
      className="w-full h-full z-0 outline-none"
      fadeAnimation={true}
      markerZoomAnimation={true}
    >
      <TileLayer
        key={mapTheme}
        attribution={mapTheme === 'colored' ? '&copy; Google Maps' : '&copy; <a href="https://carto.com/attributions">CARTO</a>'}
        url={mapTheme === 'colored'
          ? "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"}
        maxZoom={19}
        keepBuffer={4}
        className={mapTheme === 'colored' ? '' : 'map-tiles-carto-dark'}
      />
      <MapEvents
        interactionMode={interactionMode}
        newNodeType={newNodeType}
        onAddNode={handleAddNode}
        onSelectEmpty={() => { setSelectedNode(null); setSelectedEdge(null); }}
        onZoomChange={setCurrentZoom}
        readOnly={readOnly}
      />
      <RightClickPan />
      <FlyToHandler flyToTarget={flyToTarget} onFlyToComplete={onFlyToComplete} />
      {!readOnly && <KeyboardHandler onUndo={handleUndo} />}

      {/* Cari blok validEdges.map dan ubah menjadi seperti ini */}
{validEdges.map(edge => (
  <Polyline
    key={edge.id}
    positions={[[edge.fromNode.latitude, edge.fromNode.longitude], [edge.toNode.latitude, edge.toNode.longitude]]}
    pathOptions={{
      color: getEdgeColor(edge),
      weight: selectedEdge?.id === edge.id ? 5 : 3.5,
      dashArray: getEdgeDash(edge),
      opacity: 0.9,
      // ISI DENGAN INI: Simpan ID node langsung di dalam properti native Leaflet path
      nodeFromId: edge.from_node || edge.from,
      nodeToId: edge.to_node || edge.to
    }}
    eventHandlers={{
      click: (e) => {
        L.DomEvent.stopPropagation(e.originalEvent || e);
        if (!readOnly && interactionMode === 'delete_edge') {
          onEdgeDelete?.(edge.id);
          setEdges(prev => prev.filter(ed => ed.id !== edge.id));
          if (selectedEdge?.id === edge.id) setSelectedEdge(null);
        } else {
          setSelectedNode(null);
          setSelectedEdge(edge);
        }
      }
    }}
  />
))}
      {nodes.filter(n => !isNaN(parseFloat(n.latitude)) && !isNaN(parseFloat(n.longitude))).map(node => (
        <DraggableMarker
          key={node.id}
          node={node}
          isSelected={selectedNode?.id === node.id}
          getMarkerIcon={getMarkerIcon}
          edges={edges}
          coreInterfaces={coreInterfaces}
          showLabels={showLabels}
          interactionMode={interactionMode}
          readOnly={readOnly}
          handleNodeClick={handleNodeClick}
          setNodes={setNodes}
          pushUndo={pushUndo}
          setSelectedEdge={setSelectedEdge}
          setSelectedNode={setSelectedNode}
        />
      ))}
    </MapContainer>
  );
}
