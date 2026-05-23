'use client';
import { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const getMarkerIcon = (node, isDown, isUp, isDisabled, showLabels, isFront) => {
    let colorClass = 'bg-blue-500 border-blue-200';
    const t = node.type?.toLowerCase() || '';
    const isInfrastructure = ['olt', 'odc', 'odp', 'core', 'pole'].includes(t);

    if (isDisabled) colorClass = 'bg-slate-500 border-slate-300';
    else if (isUp) colorClass = isInfrastructure ? 'bg-blue-500 border-blue-300 ring-2 ring-blue-500/50' : 'bg-emerald-500 border-emerald-300 ring-2 ring-emerald-500/50';
    else if (isDown) colorClass = 'bg-red-500 border-red-300 ring-2 ring-red-500/50';
    else {
        if (node.status === 'online') colorClass = isInfrastructure ? 'bg-blue-500 border-blue-300 ring-2 ring-blue-500/50' : 'bg-emerald-500 border-emerald-300 ring-2 ring-emerald-500/50';
        else if (node.status === 'offline') { colorClass = 'bg-red-500 border-red-300 ring-2 ring-red-500/50'; }
        else if (t === 'core' || t === 'olt') colorClass = 'bg-blue-600 border-blue-300';
        else if (t === 'client') colorClass = 'bg-purple-500 border-purple-200';
        else colorClass = 'bg-slate-500 border-slate-300';
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
      html: `<div class="group/marker relative transition-transform duration-200 flex flex-col items-center justify-center scale-90 hover:scale-110 ${isFront ? 'z-[9999]' : 'z-0'} hover:z-[9999]">
        ${html}
        <div class="absolute top-full mt-1 whitespace-nowrap text-[8px] font-bold text-slate-200 bg-slate-900/80 px-1 py-0.5 rounded border border-slate-700/50 pointer-events-none shadow-md transition-opacity duration-200 ${showLabels || isFront ? 'opacity-100' : 'opacity-0 group-hover/marker:opacity-100'}">${node.label || 'Tanpa Label'}</div>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
};

const MemoizedDashboardMarker = ({ node, coreInterfaces, edges, mappings, showLabels, isActive, onMarkerClick }) => {
  const { isDown, isUp, isDisabled } = useMemo(() => {
    let down = false, up = false, disabled = false;
    if (node.linked_interface) {
        const linkedPrefix = node.linked_interface.toLowerCase();
        
        // 1. Cek dari mappings gabungan
        const m = mappings || [];
        const mappedNode = m.find(map => map.prefix && map.prefix.toLowerCase() === linkedPrefix);
        
        if (mappedNode) {
            if (mappedNode.final_status === 'Offline') down = true;
            else if (mappedNode.final_status === 'Online') up = true;
        } else {
            // 2. Cek status interface murni
            const matchedIface = coreInterfaces.find(i => i.name && i.name.toLowerCase() === linkedPrefix);
            if (matchedIface) {
                if (matchedIface.disabled === 'true') disabled = true;
                else if (matchedIface.running === 'true') up = true;
                else down = true;
            }
        }
    } else if (node.type?.toLowerCase() !== 'core') {
        const connectedEdges = edges.filter(e => e.from_node === node.id || e.to_node === node.id || e.from === node.id || e.to === node.id);
        if (connectedEdges.length === 0) disabled = true;
        else up = true;
    }
    return { isDown: down, isUp: up, isDisabled: disabled };
  }, [node.linked_interface, node.type, node.id, coreInterfaces, edges, mappings]);

  const finalIsDown = (!isDisabled && !isDown && node.status === 'offline') ? true : isDown;

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
  
  // Jika isActive (di-klik), paksa z-index sangat tinggi agar tidak tertutup node lain
  const zIndex = isActive ? 9999 : (finalIsDown ? 2000 : 0) + typePriority;

  const icon = useMemo(() => {
    return getMarkerIcon(node, isDown, isUp, isDisabled, showLabels, isActive);
  }, [node.type, node.status, node.label, isDown, isUp, isDisabled, showLabels, isActive]);

  return (
    <Marker
      position={[parseFloat(node.latitude), parseFloat(node.longitude)]}
      icon={icon}
      zIndexOffset={zIndex}
      eventHandlers={{
        click: () => onMarkerClick(node.id)
      }}
    />
  );
};

export default function DashboardMap({ topologyNodes = [], edges = [], coreInterfaces = [], mappings = [], mapTheme = 'dark', showLabels = false }) {
  const [activeNodeId, setActiveNodeId] = useState(null);

  // Peta selalu terpusat di Kantor Bupati Kabupaten Bandung
  const validNodes = topologyNodes.filter(n => n.latitude != null && n.longitude != null && n.latitude !== '' && !isNaN(parseFloat(n.latitude)));
  const mapCenter = [-7.022222564193077, 107.52746684693963];

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

  const getEdgeColor = (edge) => {
    const matchedIface = findMatchingInterface(edge);
    const isInfrastructure = edge.fromNode?.type?.toLowerCase() !== 'client' && edge.toNode?.type?.toLowerCase() !== 'client';

    if (matchedIface) {
      if (matchedIface.disabled === 'true') return '#475569';
      if (matchedIface.running === 'true') return isInfrastructure ? '#3b82f6' : '#22c55e';
      return '#ef4444';
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

  return (
    <div className="w-full h-full">
      <MapContainer center={mapCenter} zoom={16} className="w-full h-full" zoomControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false}>
        <TileLayer
          key={mapTheme}
          attribution={mapTheme === 'colored' ? '&copy; Google Maps' : '&copy; <a href="https://carto.com/attributions">CARTO</a>'}
          url={mapTheme === 'colored'
            ? "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"}
          className={mapTheme === 'colored' ? '' : 'map-tiles-carto-dark'}
        />
        {edges.map(edge => {
          const fromNode = validNodes.find(d => d.id === edge.from_node || d.id === edge.from);
          const toNode = validNodes.find(d => d.id === edge.to_node || d.id === edge.to);
          if (!fromNode || !toNode) return null;
          const edgeObj = { ...edge, fromNode, toNode };
          return (
            <Polyline
              key={edge.id}
              positions={[[parseFloat(fromNode.latitude), parseFloat(fromNode.longitude)], [parseFloat(toNode.latitude), parseFloat(toNode.longitude)]]}
              pathOptions={{ color: getEdgeColor(edgeObj), weight: 3, opacity: 0.8, dashArray: getEdgeDash(edgeObj) }}
            />
          );
        })}
        {validNodes.map(node => (
          <MemoizedDashboardMarker
            key={node.id}
            node={node}
            coreInterfaces={coreInterfaces}
            mappings={mappings}
            edges={edges}
            showLabels={showLabels}
            isActive={activeNodeId === node.id}
            onMarkerClick={(id) => setActiveNodeId(prev => prev === id ? null : id)}
          />
        ))}
      </MapContainer>
    </div>
  );
}
