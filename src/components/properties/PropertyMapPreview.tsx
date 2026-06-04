import { useEffect, useRef } from "react";
import { loadGoogleMapsMap } from "@/lib/googleMapsLoader";

interface PropertyMapPreviewProps {
  latitude: number;
  longitude: number;
  className?: string;
  zoom?: number;
}

/**
 * Drill-down map preview for a single property (Maps JavaScript API).
 * Not a navigation surface — context only per Ch. 19.
 */
export function PropertyMapPreview({
  latitude,
  longitude,
  className = "",
  zoom = 15,
}: PropertyMapPreviewProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    void loadGoogleMapsMap().then(() => {
      if (cancelled || !mapRef.current || typeof google === "undefined") return;
      const center = { lat: latitude, lng: longitude };
      const map = new google.maps.Map(mapRef.current, {
        center,
        zoom,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      new google.maps.Marker({ position: center, map });
    });

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, zoom]);

  return (
    <div
      ref={mapRef}
      className={`rounded-xl overflow-hidden shadow-md min-h-[160px] bg-muted ${className}`}
      aria-label="Property location map"
    />
  );
}
