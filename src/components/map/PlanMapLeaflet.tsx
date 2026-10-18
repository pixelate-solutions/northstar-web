"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, ZoomControl } from "react-leaflet";

import type { LatLng } from "@/components/trip/useRoute";

export interface MapPin {
  id: number;
  lat: number;
  lng: number;
  label: string;
  title: string;
  highlighted?: boolean;
  showTitle?: boolean;
}

export interface MapProps {
  pins: MapPin[];
  extraPins?: Array<{ id: number; lat: number; lng: number; title: string }>;
  route: LatLng[] | null;
  selectedId?: number | null;
  onSelect?: (id: number) => void;
}

function pinIcon(label: string, active: boolean, highlighted: boolean) {
  const size = active ? 34 : 28;
  const bg = active || highlighted ? "#FFC500" : "#111110";
  const fg = active || highlighted ? "#111110" : "#FFFFFF";
  const border = active || highlighted ? "#111110" : "#FFFFFF";
  return L.divIcon({
    className: "ns-pin",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${bg};border:3px solid ${border};display:flex;align-items:center;justify-content:center;font:600 ${label.length > 2 ? 10 : 12}px var(--font-mono),monospace;color:${fg};box-shadow:0 1px 3px rgba(0,0,0,.25)">${label}</div>`,
  });
}

const extraIcon = L.divIcon({
  className: "ns-pin",
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  html: `<div style="width:12px;height:12px;border-radius:999px;background:#8A8A84;border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.2)"></div>`,
});

function FitBounds({ points, padding }: { points: LatLng[]; padding: number }) {
  const map = useMap();
  const key = points.map((point) => point.join(",")).join("|");
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 12, { animate: false });
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [padding, padding], animate: false, maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

export default function PlanMapLeaflet({ pins, extraPins = [], route, selectedId, onSelect }: MapProps) {
  const pinPoints = useMemo(() => pins.map((pin) => [pin.lat, pin.lng] as LatLng), [pins]);
  const boundsPoints = pinPoints.length ? pinPoints : extraPins.map((pin) => [pin.lat, pin.lng] as LatLng);
  const line = route && route.length > 1 ? route : pinPoints.length > 1 ? pinPoints : null;

  return (
    <MapContainer
      center={boundsPoints[0] ?? [39.5, -98.35]}
      zoom={boundsPoints.length ? 9 : 4}
      zoomControl={false}
      attributionControl
      className="h-full w-full"
      style={{ background: "#EEEDE8" }}
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        attribution='Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxNativeZoom={16}
        maxZoom={18}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
        maxNativeZoom={16}
        maxZoom={18}
      />
      <ZoomControl position="topright" />
      <InvalidateOnResize />
      <FitBounds points={boundsPoints} padding={56} />
      {line ? (
        <>
          <Polyline positions={line} pathOptions={{ color: "#111110", weight: 8, opacity: 1, lineCap: "round", lineJoin: "round" }} />
          <Polyline positions={line} pathOptions={{ color: "#FFC500", weight: 4.5, opacity: 1, lineCap: "round", lineJoin: "round" }} />
        </>
      ) : null}
      {extraPins.map((pin) => (
        <Marker key={`x${pin.id}`} position={[pin.lat, pin.lng]} icon={extraIcon}>
          <Tooltip className="ns-tip" direction="right" offset={[8, 0]}>
            {pin.title}
          </Tooltip>
        </Marker>
      ))}
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          position={[pin.lat, pin.lng]}
          icon={pinIcon(pin.label, pin.id === selectedId, Boolean(pin.highlighted))}
          zIndexOffset={pin.id === selectedId ? 1000 : 0}
          eventHandlers={{ click: () => onSelect?.(pin.id) }}
        >
          <Tooltip className="ns-tip" direction="right" offset={[14, 0]} permanent={Boolean(pin.showTitle)}>
            {pin.title}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
