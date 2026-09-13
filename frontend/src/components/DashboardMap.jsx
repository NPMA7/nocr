'use client';
import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';

const getMarkerIcon = (node, isDown, isUp, isDisabled, showLabels, isFront) => {
    let colorClass = 'bg-blue-500 border-blue-200';
    const t = node.type?.toLowerCase() || '';
    const isInfrastructure = ['olt', 'odc', 'odp', 'core'].includes(t);
    let isOffline = false;

    if (isDisabled) colorClass = 'bg-slate-500 border-slate-300';
    else if (isUp) colorClass = isInfrastructure ? 'bg-blue-500 border-blue-300 ring-2 ring-blue-500/50' : 'bg-emerald-500 border-emerald-300 ring-2 ring-emerald-500/50';
    else if (isDown) { colorClass = 'bg-red-500 border-red-300 ring-2 ring-red-500/50'; isOffline = true; }
    else {
        if (node.status === 'online') colorClass = isInfrastructure ? 'bg-blue-500 border-blue-300 ring-2 ring-blue-500/50' : 'bg-emerald-500 border-emerald-300 ring-2 ring-emerald-500/50';
        else if (node.status === 'offline') { colorClass = 'bg-red-500 border-red-300 ring-2 ring-red-500/50'; isOffline = true; }
        else if (t === 'core' || t === 'olt') colorClass = 'bg-blue-600 border-blue-300';
        else if (t === 'client') colorClass = 'bg-sky-500 border-sky-200';
        else colorClass = 'bg-slate-500 border-slate-300';
    }

    const isLabelActive = showLabels === true || showLabels === 'all' || (showLabels === 'offline' && isOffline);

    let html = '';
    switch (t) {
      case 'olt': html = `<div class="w-8 h-8 rounded-lg flex items-center justify-center border text-white shadow-lg ${colorClass}"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg></div>`; break;
      case 'odc': html = `<div class="w-8 h-8 rounded-full flex items-center justify-center border text-white shadow-lg ${colorClass}"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg></div>`; break;
      case 'odp': html = `<div class="w-8 h-8 rounded-full flex items-center justify-center border text-white shadow-lg ${colorClass}"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/></svg></div>`; break;
      case 'client': html = `<div class="w-6 h-6 rounded-full flex items-center justify-center border text-white shadow-md ${colorClass}"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`; break;
      default: html = `<div class="w-6 h-6 rounded-full flex items-center justify-center border text-white shadow-md ${colorClass}"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg></div>`;
    }

    return L.divIcon({
      className: 'custom-leaflet-icon',
      html: `<div class="group/marker relative transition-transform duration-200 flex flex-col items-center justify-center scale-90 hover:scale-110 ${isFront ? 'z-[9999]' : 'z-0'} hover:z-[9999]">
        ${html}
        <div class="absolute top-full mt-1 whitespace-nowrap text-[8px] font-bold ${isOffline ? 'text-red-200 bg-red-950/90 border-red-500/50' : 'text-slate-200 bg-slate-900/80 border-slate-700/50'} px-1 py-0.5 rounded border pointer-events-none shadow-md transition-opacity duration-200 ${isLabelActive || isFront ? 'opacity-100' : 'opacity-0 group-hover/marker:opacity-100'}">${node.label || 'Tanpa Label'}</div>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
};

const MemoizedDashboardMarker = React.memo(({ node, isDown, isUp, isDisabled, showLabels, isActive, onMarkerClick }) => {
  const finalIsDown = (!isDisabled && !isDown && node.status === 'offline') ? true : isDown;

  const typePriority = useMemo(() => {
    const t = node.type?.toLowerCase() || '';
    switch (t) {
      case 'olt': return 800;
      case 'core': return 600;
      case 'client': return 200;
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
});

export default function DashboardMap({ topologyNodes = [], edges = [], coreInterfaces = [], mappings = [], mapTheme = 'dark', showLabels = false, networkMode = 'pppoe' }) {
  const [activeNodeId, setActiveNodeId] = useState(null);

  const mapNodes = useMemo(() => {
    let filtered = topologyNodes;

    // 1. Build strict directed tree outward from OLTs (ignores how user drew the edges)
    const undirectedAdj = {};
    const nodeMap = new Map();
    topologyNodes.forEach((n) => {
      undirectedAdj[n.id] = [];
      nodeMap.set(n.id, n);
    });
    edges.forEach((e) => {
      const from = e.from_node ?? e.from;
      const to = e.to_node ?? e.to;
      if (undirectedAdj[from] && undirectedAdj[to]) {
        undirectedAdj[from].push(to);
        undirectedAdj[to].push(from);
      }
    });

    const directedAdj = {};
    topologyNodes.forEach((n) => (directedAdj[n.id] = []));

    const visitedBFS = new Set();
    const queue = [];

    // Prioritas 1: OLT
    topologyNodes
      .filter((n) => n.type === "olt")
      .forEach((n) => {
        visitedBFS.add(n.id);
        queue.push(n.id);
      });

    const processQueue = () => {
      while (queue.length > 0) {
        const curr = queue.shift();
        for (const neighbor of undirectedAdj[curr]) {
          if (!visitedBFS.has(neighbor)) {
            visitedBFS.add(neighbor);
            directedAdj[curr].push(neighbor);
            queue.push(neighbor);
          }
        }
      }
    };
    
    processQueue();
    
    topologyNodes.filter(n => n.type === "odc" && !visitedBFS.has(n.id)).forEach(n => {
       visitedBFS.add(n.id); queue.push(n.id);
    });
    processQueue();

    topologyNodes.filter(n => (n.type === "odp") && !visitedBFS.has(n.id)).forEach(n => {
       visitedBFS.add(n.id); queue.push(n.id);
    });
    processQueue();

    // 2. Count downstream clients for each node
    const counts = {};
    const visiting = new Set();

    const getCounts = (id) => {
      if (counts[id]) return counts[id];
      if (visiting.has(id)) return { l2tp: 0, pppoe: 0 };
      visiting.add(id);

      const res = { l2tp: 0, pppoe: 0 };
      const node = nodeMap.get(id);

      if (node) {
        if (node.type === "client" || node.type === "pppoe-client") {
          let isPPPoE =
            node.linked_interface?.toLowerCase().includes("pppoe") ||
            node.type === "pppoe-client";
            
          if (!isPPPoE && node.linked_interface) {
            const m = mappings?.find(map => map.prefix && map.prefix.toLowerCase() === node.linked_interface.toLowerCase());
            if (m && m.connection_type === 'PPPOE') isPPPoE = true;
          }

          if (isPPPoE) res.pppoe++;
          else res.l2tp++;
        }
      }

      for (const child of directedAdj[id] || []) {
        const childCounts = getCounts(child);
        res.l2tp += childCounts.l2tp;
        res.pppoe += childCounts.pppoe;
      }

      counts[id] = res;
      visiting.delete(id);
      return res;
    };

    topologyNodes.forEach((n) => getCounts(n.id));

    // 3. Filter nodes
    filtered = filtered.filter((n) => {
      if (n.type === "client" || n.type === "pppoe-client") {
        let isPPPoE =
          n.linked_interface?.toLowerCase().includes("pppoe") ||
          n.type === "pppoe-client";
          
        if (!isPPPoE && n.linked_interface) {
          const m = mappings?.find(map => map.prefix && map.prefix.toLowerCase() === n.linked_interface.toLowerCase());
          if (m && m.connection_type === 'PPPOE') isPPPoE = true;
        }

        if (!n.linked_interface && n.type === "client") return true;
        
        if (networkMode === "l2tp") return !isPPPoE;
        if (networkMode === "pppoe") return isPPPoE;
      } else {
        const c = counts[n.id] || { l2tp: 0, pppoe: 0 };
        if (networkMode === "l2tp") {
          if (c.pppoe > 0 && c.l2tp === 0) return false;
          return true;
        }
        if (networkMode === "pppoe") {
          if (c.l2tp > 0 && c.pppoe === 0) return false;
          return true;
        }
      }
      return true;
    });

    return filtered;
  }, [topologyNodes, edges, networkMode, mappings]);

  const mapNodeIds = useMemo(() => new Set(mapNodes.map((n) => n.id)), [mapNodes]);

  const mapEdges = useMemo(() => {
    return edges.filter((e) => {
      const fromId = e.from_node ?? e.from;
      const toId = e.to_node ?? e.to;
      return mapNodeIds.has(fromId) && mapNodeIds.has(toId);
    });
  }, [edges, mapNodeIds]);

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
        {mapEdges.map(edge => {
          const fromNode = mapNodes.find(d => d.id === edge.from_node || d.id === edge.from);
          const toNode = mapNodes.find(d => d.id === edge.to_node || d.id === edge.to);
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
        {mapNodes.filter(n => n.latitude != null && n.longitude != null && n.latitude !== '' && !isNaN(parseFloat(n.latitude))).map(node => {
          let down = false, up = false, disabled = false;
          if (node.linked_interface) {
              const linkedPrefix = node.linked_interface.toLowerCase();
              const m = mappings || [];
              const mappedNode = m.find(map => map.prefix && map.prefix.toLowerCase() === linkedPrefix);
              
              if (mappedNode) {
                  if (mappedNode.final_status === 'Offline') down = true;
                  else if (mappedNode.final_status === 'Online') up = true;
              } else {
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

          return (
            <MemoizedDashboardMarker
              key={node.id}
              node={node}
              isDown={down}
              isUp={up}
              isDisabled={disabled}
              showLabels={showLabels}
              isActive={activeNodeId === node.id}
              onMarkerClick={(id) => setActiveNodeId(prev => prev === id ? null : id)}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
