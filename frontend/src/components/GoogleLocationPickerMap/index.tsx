import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import { useLocation } from "react-router-dom";
import "./GoogleLocationPickerMap.css";
import { GOOGLE_MAPS_API_KEY, type Coordinates } from "../../lib/googleMaps";

type GoogleLocationPickerMapProps = {
  center: Coordinates;
  onSelect: (coords: Coordinates) => void;
  className?: string;
  zoom?: number;
};

export default function GoogleLocationPickerMap({
  center,
  onSelect,
  className,
  zoom = 15,
}: GoogleLocationPickerMapProps) {
  const location = useLocation();
  const mapRef = useRef<google.maps.Map | null>(null);
  const latestCenterRef = useRef(center);
  const [authError, setAuthError] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });
  const mapInstanceKey = `${location.pathname}:${location.key}`;
  const embedSrc = useMemo(
    () => `https://maps.google.com/maps?q=${center.lat},${center.lng}&z=${zoom}&output=embed`,
    [center.lat, center.lng, zoom]
  );

  useEffect(() => {
    const original = (window as unknown as { gm_authFailure?: (() => void) | undefined }).gm_authFailure;
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
      setAuthError(true);
    };

    return () => {
      (window as unknown as { gm_authFailure?: (() => void) | undefined }).gm_authFailure = original;
    };
  }, []);

  useEffect(() => {
    latestCenterRef.current = center;
  }, [center]);

  useEffect(() => {
    setMapReady(false);
  }, [mapInstanceKey]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.panTo(center);
  }, [center]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    const map = mapRef.current;
    const triggerResizeAndRecenter = () => {
      google.maps.event.trigger(map, "resize");
      map.panTo(latestCenterRef.current);
    };

    const mapDiv = map.getDiv();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => triggerResizeAndRecenter())
        : null;
    if (observer && mapDiv instanceof Element) {
      observer.observe(mapDiv);
    }

    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        triggerResizeAndRecenter();
      }
    };
    const pageShowHandler = () => triggerResizeAndRecenter();

    document.addEventListener("visibilitychange", visibilityHandler);
    window.addEventListener("pageshow", pageShowHandler);

    const t1 = window.setTimeout(triggerResizeAndRecenter, 0);
    const t2 = window.setTimeout(triggerResizeAndRecenter, 150);
    const t3 = window.setTimeout(triggerResizeAndRecenter, 400);

    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", visibilityHandler);
      window.removeEventListener("pageshow", pageShowHandler);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [isLoaded, mapInstanceKey]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className={`${className ?? ""} google-location-picker-loading`}>
        Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>frontend/.env</code> to enable map.
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`${className ?? ""} google-location-picker-error`}>
        Failed to load Google Maps script. Check API key and network.
      </div>
    );
  }

  if (authError) {
    return (
      <div className={`${className ?? ""} google-location-picker-container`}>
        <iframe
          title="Map preview"
          src={embedSrc}
          className="google-location-picker-iframe"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`${className ?? ""} google-location-picker-loading`}>
        Loading map...
      </div>
    );
  }

  return (
    <div className={`${className ?? ""} google-location-picker-wrapper`}>
      <GoogleMap
        key={mapInstanceKey}
        center={center}
        zoom={zoom}
        mapContainerClassName="google-location-picker-map-container"
        onLoad={(map) => {
          mapRef.current = map;
          // In SPA route transitions, map can mount before final layout.
          // Trigger a delayed resize + recenter to avoid blank tiles.
          window.setTimeout(() => {
            if (!mapRef.current) return;
            google.maps.event.trigger(mapRef.current, "resize");
            mapRef.current.panTo(center);
          }, 120);
        }}
        onTilesLoaded={() => {
          setMapReady(true);
        }}
        onClick={(event) => {
          const lat = event.latLng?.lat();
          const lng = event.latLng?.lng();
          if (lat === undefined || lng === undefined) return;
          onSelect({ lat, lng });
        }}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        }}
      >
        <MarkerF
          position={center}
          draggable
          onDragEnd={(event) => {
            const lat = event.latLng?.lat();
            const lng = event.latLng?.lng();
            if (lat === undefined || lng === undefined) return;
            onSelect({ lat, lng });
          }}
        />
      </GoogleMap>
      {!mapReady && (
        <div className="google-location-picker-overlay">
          <div className="skeleton google-location-picker-map-loading" />
        </div>
      )}
    </div>
  );
}