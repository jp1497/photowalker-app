/**
 * Map layer for the route highlighted from the Explore panel (PRD v6 Step 4.3).
 * Renders photo pins with thumbnails and zoom-size behaviour matching the browse layer,
 * with a defined golden border. When highlightedRouteSlug is null, removes the layer.
 */
import { useCallback, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { fetchPhotoImageBlob } from '../../api/photos';
import { getRouteBySlug } from '../../api/routes';
import { useMapContext } from '../../contexts/MapContext';
import {
  browsePinIconSizeAtZoom,
  createDefaultPinImageData,
  imageToPinImageData,
  MAP_PIN_RASTER_SIZE,
  PIN_ICON_SIZE,
} from './pinImageUtils';
import type { RouteDetailPhoto } from '../../types/route';

const HIGHLIGHTED_SOURCE_ID = 'highlighted-route-source';
const HIGHLIGHTED_LAYER_ID = 'highlighted-route-layer';
const HIGHLIGHTED_DEFAULT_IMAGE_ID = 'highlighted-default-pin';
const HIGHLIGHTED_PIN_PREFIX = 'highlighted-pin-';

/** Blue border for highlighted route pins (matches app primary blue, more defined than browse white border). */
const HIGHLIGHTED_BORDER = { strokeStyle: '#2563eb', lineWidth: 8 };

function buildHighlightedPhotosGeoJSON(
  photos: RouteDetailPhoto[]
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const photo of photos) {
    const coords = photo.location?.coordinates;
    if (!coords || coords.length < 2) continue;
    features.push({
      type: 'Feature',
      properties: {
        photoId: photo.id,
        imageId: HIGHLIGHTED_PIN_PREFIX + photo.id,
      },
      geometry: { type: 'Point', coordinates: [coords[0], coords[1]] },
    });
  }
  return { type: 'FeatureCollection', features };
}

export interface HighlightedRouteLayerProps {
  /** Route slug to highlight; null clears the layer. */
  highlightedRouteSlug: string | null;
  /** Called when the highlighted layer is added (true) or removed (false). Browse fades only when true to avoid a visible gap. */
  onHighlightedLayerReadyChange?: (ready: boolean) => void;
}

export function HighlightedRouteLayer({
  highlightedRouteSlug,
  onHighlightedLayerReadyChange,
}: HighlightedRouteLayerProps) {
  const mapContext = useMapContext();
  const layerAddedRef = useRef(false);
  const currentSlugRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const zoomHandlerRef = useRef<(() => void) | null>(null);
  const objectUrlsRef = useRef<Record<string, string>>({});
  const imageIdsRef = useRef<string[]>([]);

  useEffect(() => {
    currentSlugRef.current = highlightedRouteSlug;
  }, [highlightedRouteSlug]);

  const removeLayer = useCallback(
    (map: MapLibreMap) => {
      try {
        onHighlightedLayerReadyChange?.(false);
        if (zoomHandlerRef.current) {
          map.off('zoom', zoomHandlerRef.current);
          zoomHandlerRef.current = null;
        }
        imageIdsRef.current.forEach((id) => {
          try {
            if (map.hasImage(id)) map.removeImage(id);
          } catch {
            /* ignore */
          }
        });
      imageIdsRef.current = [];
      Object.values(objectUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = {};
      if (map.getLayer(HIGHLIGHTED_LAYER_ID)) map.removeLayer(HIGHLIGHTED_LAYER_ID);
      if (map.getSource(HIGHLIGHTED_SOURCE_ID)) map.removeSource(HIGHLIGHTED_SOURCE_ID);
    } catch {
      /* ignore */
    }
    layerAddedRef.current = false;
  },
    [onHighlightedLayerReadyChange]
  );

  useEffect(() => {
    if (!mapContext) return;

    const setupOrUpdate = (map: MapLibreMap) => {
      if (!highlightedRouteSlug) {
        removeLayer(map);
        return;
      }

      const requestedSlug = highlightedRouteSlug;
      getRouteBySlug(highlightedRouteSlug)
        .then((res) => {
          if (currentSlugRef.current !== requestedSlug) return;
          const photosWithLocation = res.photos.filter(
            (p) => (p.location?.coordinates?.length ?? 0) >= 2
          );
          if (photosWithLocation.length === 0) {
            removeLayer(map);
            return;
          }
          const geojson = buildHighlightedPhotosGeoJSON(photosWithLocation);

          const defaultPin = createDefaultPinImageData(MAP_PIN_RASTER_SIZE, HIGHLIGHTED_BORDER);
          if (!map.hasImage(HIGHLIGHTED_DEFAULT_IMAGE_ID)) {
            map.addImage(HIGHLIGHTED_DEFAULT_IMAGE_ID, defaultPin);
            imageIdsRef.current.push(HIGHLIGHTED_DEFAULT_IMAGE_ID);
          }

          if (!map.getSource(HIGHLIGHTED_SOURCE_ID)) {
            map.addSource(HIGHLIGHTED_SOURCE_ID, { type: 'geojson', data: geojson });

            photosWithLocation.forEach((p) => {
              const id = HIGHLIGHTED_PIN_PREFIX + p.id;
              try {
                if (!map.hasImage(id)) {
                  map.addImage(id, defaultPin);
                  imageIdsRef.current.push(id);
                }
              } catch {
                /* ignore */
              }
            });

            const baseSize = PIN_ICON_SIZE / MAP_PIN_RASTER_SIZE;
            const updateIconSize = () => {
              try {
                if (map.getLayer(HIGHLIGHTED_LAYER_ID)) {
                  const zoom = map.getZoom();
                  map.setLayoutProperty(
                    HIGHLIGHTED_LAYER_ID,
                    'icon-size',
                    baseSize * browsePinIconSizeAtZoom(zoom)
                  );
                }
              } catch {
                /* layer/source may be gone */
              }
            };

            map.addLayer({
              id: HIGHLIGHTED_LAYER_ID,
              type: 'symbol',
              source: HIGHLIGHTED_SOURCE_ID,
              layout: {
                'icon-image': ['coalesce', ['get', 'imageId'], HIGHLIGHTED_DEFAULT_IMAGE_ID],
                'icon-size': baseSize * browsePinIconSizeAtZoom(map.getZoom()),
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
              },
            });
            zoomHandlerRef.current = updateIconSize;
            map.on('zoom', updateIconSize);
            updateIconSize();
            layerAddedRef.current = true;
            onHighlightedLayerReadyChange?.(true);
          } else {
            (map.getSource(HIGHLIGHTED_SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson);
            photosWithLocation.forEach((p) => {
              const id = HIGHLIGHTED_PIN_PREFIX + p.id;
              if (!map.hasImage(id)) {
                try {
                  map.addImage(id, defaultPin);
                  imageIdsRef.current.push(id);
                } catch {
                  /* ignore */
                }
              }
            });
          }

          photosWithLocation.forEach((p) => {
            const id = HIGHLIGHTED_PIN_PREFIX + p.id;
            let cancelled = false;
            fetchPhotoImageBlob(p.id, 'thumbnail')
              .then((blob) => {
                if (cancelled || currentSlugRef.current !== requestedSlug) return;
                const url = URL.createObjectURL(blob);
                objectUrlsRef.current[p.id] = url;
                const img = new Image();
                img.onload = () => {
                  if (cancelled || currentSlugRef.current !== requestedSlug) return;
                  try {
                    if (!map.getStyle()) return;
                    if (map.hasImage(id)) map.removeImage(id);
                    const pinData = imageToPinImageData(img, MAP_PIN_RASTER_SIZE, HIGHLIGHTED_BORDER);
                    map.addImage(id, pinData);
                  } catch {
                    /* layer/source may be gone */
                  }
                };
                img.src = url;
              })
              .catch(() => {
                /* keep default pin */
              });
            return () => {
              cancelled = true;
            };
          });
        })
        .catch(() => {
          removeLayer(map);
        });
    };

    const cleanup = (map: MapLibreMap) => {
      removeLayer(map);
    };

    if (mapContext.map) {
      cancelledRef.current = false;
      if (!highlightedRouteSlug) {
        removeLayer(mapContext.map);
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
  }, [mapContext, highlightedRouteSlug, removeLayer, onHighlightedLayerReadyChange]);

  return null;
}
