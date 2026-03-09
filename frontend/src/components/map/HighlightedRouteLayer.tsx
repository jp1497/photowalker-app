/**
 * Map layer for the route highlighted from the Explore panel (PRD v6 Step 4.3).
 * Renders photo callout pins with a blue outline. When highlightedRouteSlug is null,
 * removes the markers.
 */
import { useCallback, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { fetchPhotoImageBlob } from '../../api/photos';
import { getRouteBySlug } from '../../api/routes';
import { useMapContext } from '../../contexts/MapContext';
import { createPhotoCalloutElement, setCalloutThumbnail } from './PhotoMarker';

const HIGHLIGHTED_BUBBLE_STYLE = 'outline: 2px solid #2563eb; outline-offset: 2px;';

export interface HighlightedRouteLayerProps {
  /** Route slug to highlight; null clears the markers. */
  highlightedRouteSlug: string | null;
  /** Called when highlighted markers are added (true) or removed (false). */
  onHighlightedLayerReadyChange?: (ready: boolean) => void;
}

export function HighlightedRouteLayer({
  highlightedRouteSlug,
  onHighlightedLayerReadyChange,
}: HighlightedRouteLayerProps) {
  const mapContext = useMapContext();
  const currentSlugRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const photoMarkersRef = useRef<maplibregl.Marker[]>([]);
  const objectUrlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    currentSlugRef.current = highlightedRouteSlug;
  }, [highlightedRouteSlug]);

  const removeMarkers = useCallback(
    (map: MapLibreMap) => {
      onHighlightedLayerReadyChange?.(false);
      photoMarkersRef.current.forEach((m) => { try { m.remove(); } catch { /* ignore */ } });
      photoMarkersRef.current = [];
      Object.values(objectUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = {};
      void map; // map not needed but kept for consistent API
    },
    [onHighlightedLayerReadyChange]
  );

  useEffect(() => {
    if (!mapContext) return;

    const setupOrUpdate = (map: MapLibreMap) => {
      if (!highlightedRouteSlug) {
        removeMarkers(map);
        return;
      }

      const requestedSlug = highlightedRouteSlug;
      getRouteBySlug(highlightedRouteSlug)
        .then((res) => {
          if (currentSlugRef.current !== requestedSlug) return;
          const photosWithLocation = res.photos.filter(
            (p) => (p.location?.coordinates?.length ?? 0) >= 2
          );

          // Teardown previous markers before building new ones
          photoMarkersRef.current.forEach((m) => { try { m.remove(); } catch { /* ignore */ } });
          photoMarkersRef.current = [];
          Object.values(objectUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
          objectUrlsRef.current = {};

          if (photosWithLocation.length === 0) {
            onHighlightedLayerReadyChange?.(false);
            return;
          }

          photosWithLocation.forEach((p) => {
            const coords = p.location?.coordinates;
            if (!coords || coords.length < 2) return;
            const [lng, lat] = coords as [number, number];
            const el = createPhotoCalloutElement();
            el.dataset.photoId = p.id;
            // Apply blue outline to visually distinguish highlighted pins
            const bubble = el.querySelector('.photo-callout-bubble') as HTMLElement | null;
            if (bubble) bubble.style.cssText += HIGHLIGHTED_BUBBLE_STYLE;
            const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
              .setLngLat([lng, lat])
              .addTo(map);
            photoMarkersRef.current.push(marker);
          });

          onHighlightedLayerReadyChange?.(true);

          // Fetch thumbnails and update markers in-place
          photosWithLocation.forEach((p) => {
            fetchPhotoImageBlob(p.id, 'thumbnail')
              .then((blob) => {
                if (cancelledRef.current || currentSlugRef.current !== requestedSlug) return;
                const url = URL.createObjectURL(blob);
                objectUrlsRef.current[p.id] = url;
                const marker = photoMarkersRef.current.find(
                  (m) => m.getElement().dataset.photoId === p.id
                );
                if (marker) setCalloutThumbnail(marker.getElement(), url);
              })
              .catch(() => {
                /* keep empty placeholder */
              });
          });
        })
        .catch(() => {
          removeMarkers(map);
        });
    };

    const cleanup = (map: MapLibreMap) => {
      removeMarkers(map);
    };

    if (mapContext.map) {
      cancelledRef.current = false;
      if (!highlightedRouteSlug) {
        removeMarkers(mapContext.map);
      } else {
        setupOrUpdate(mapContext.map);
      }
      return () => {
        cancelledRef.current = true;
        cleanup(mapContext.map!);
      };
    }

    cancelledRef.current = false;
    mapContext.onMapReady((map) => {
      if (cancelledRef.current || !highlightedRouteSlug) return;
      setupOrUpdate(map);
    });
    return () => {
      cancelledRef.current = true;
      if (mapContext.map) cleanup(mapContext.map);
    };
  }, [mapContext, highlightedRouteSlug, removeMarkers, onHighlightedLayerReadyChange]);

  return null;
}
