'use client';
import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function DashboardMap({ topologyNodes = [], edges = [], coreInterfaces = [], mapTheme = 'dark' }) {
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

  const getMarkerIcon = (node) => {
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
        const connectedEdges = edges.filter(e => e.from_node === node.id || e.to_node === node.id || e.from === node.id || e.to === node.id);
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
      html: `<div class="relative transition-transform duration-200 flex flex-col items-center justify-center scale-90">
        ${html}
        <div class="absolute top-full mt-1 whitespace-nowrap text-[8px] font-bold text-slate-200 bg-slate-900/80 px-1 py-0.5 rounded border border-slate-700/50 pointer-events-none shadow-md">${node.label || 'Tanpa Label'}</div>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
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
        {validNodes.map(node => {
          return (
            <Marker
              key={node.id}
              position={[parseFloat(node.latitude), parseFloat(node.longitude)]}
              icon={getMarkerIcon(node)}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
