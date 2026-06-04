import { useEffect, useRef } from "react";
import { loadGoogleMapsMap } from "@/lib/googleMapsLoader";

export interface PropertyMapPin {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  signalWeight?: number;
}

interface PropertyPortfolioMapProps {
  properties: PropertyMapPin[];
  className?: string;
  onPropertyClick?: (propertyId: string) => void;
}

/**
 * Portfolio overview map — drill-down context for property locations and signal severity.
 */
export function PropertyPortfolioMap({
  properties,
  className = "",
  onPropertyClick,
}: PropertyPortfolioMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    const withCoords = properties.filter((p) => p.latitude != null && p.longitude != null);
    if (!mapRef.current || withCoords.length === 0) return;

    let cancelled = false;

    void loadGoogleMapsMap().then(() => {
      if (cancelled || !mapRef.current || typeof google === "undefined") return;

      const center = {
        lat: withCoords[0].latitude,
        lng: withCoords[0].longitude,
      };

      const map =
        mapInstanceRef.current ??
        new google.maps.Map(mapRef.current, {
          center,
          zoom: 10,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
        });
      mapInstanceRef.current = map;

      if (withCoords.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        withCoords.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }));
        map.fitBounds(bounds, 48);
      }

      withCoords.forEach((p) => {
        const marker = new google.maps.Marker({
          position: { lat: p.latitude, lng: p.longitude },
          map,
          title: p.label,
        });
        if (onPropertyClick) {
          marker.addListener("click", () => onPropertyClick(p.id));
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [properties, onPropertyClick]);

  if (properties.filter((p) => p.latitude != null).length === 0) {
    return (
      <div className={`rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground ${className}`}>
        Add geocoded addresses to see properties on the map.
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className={`rounded-xl overflow-hidden shadow-md min-h-[200px] bg-muted ${className}`}
      aria-label="Portfolio property map"
    />
  );
}
