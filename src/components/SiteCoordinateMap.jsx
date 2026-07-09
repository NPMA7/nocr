'use client';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const defaultCenter = [-6.2, 106.8];

function ClickHandler({ onPick, readOnly }) {
  useMapEvents({
    click(e) {
      if (!readOnly && onPick) {
        onPick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export default function SiteCoordinateMap({
  latitude,
  longitude,
  onPick,
  readOnly = false,
  className = 'h-56 w-full rounded-lg overflow-hidden border border-slate-700/50',
}) {
  const lat = latitude != null && latitude !== '' ? Number(latitude) : null;
  const lng = longitude != null && longitude !== '' ? Number(longitude) : null;
  const hasPoint = lat != null && !Number.isNaN(lat) && lng != null && !Number.isNaN(lng);
  const center = hasPoint ? [lat, lng] : defaultCenter;
  const zoom = hasPoint ? 15 : 11;

  const icon = L.divIcon({
    className: 'custom-leaflet-icon',
    html: `<div class="w-8 h-8 rounded-full flex items-center justify-center border-2 border-orange-300 bg-orange-500/90 text-white shadow-lg"><i class="fa-solid fa-map-pin text-xs"></i></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });

  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full map-tiles-dark z-0"
        scrollWheelZoom={false}
        dragging={true}
        doubleClickZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={onPick} readOnly={readOnly} />
        {hasPoint && <Marker position={[lat, lng]} icon={icon} />}
      </MapContainer>
      <p className="text-[10px] text-slate-500 mt-1.5 px-0.5">
        {readOnly
          ? 'Titik koordinat hanya dapat diubah melalui Peta Topologi'
          : 'Klik peta untuk menetapkan titik koordinat'}
      </p>
    </div>
  );
}
