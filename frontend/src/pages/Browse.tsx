/** Browse: map with photo pins (bbox fetch) or legacy list view. PRD v6 Step 3.1: browse-photos mode. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Map as MapLibreMap } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import { getBrowseRoutes } from '../api/routes';
import { fetchPhotoImageBlob, getPhotosInBbox } from '../api/photos';
import type { PhotoBrowseItem } from '../types/photo';
import {
  CLUSTER_MAX_ZOOM,
  CLUSTER_MIN_POINTS,
  CLUSTER_RADIUS,
} from '../components/map/clusterConfig';
import { MapPanel } from '../components/map/MapPanel';
import { MapView } from '../components/map/MapView';
import { RouteList } from '../components/routes/RouteList';
import { useMapContext } from '../contexts/MapContext';
import {
  createDefaultPinImageData,
  imageToPinImageData,
  MAP_PIN_RASTER_SIZE,
  PIN_ICON_SIZE,
} from '../components/map/pinImageUtils';
import { BottomDrawer } from '../components/common/BottomDrawer';
import { getWelcomeDismissed, WelcomeModal } from '../components/common/WelcomeModal';
import { PhotoGallery } from '../components/photos/PhotoGallery';
import { useAuth } from '../hooks/useAuth';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { usePreferredMapCenter } from '../hooks/usePreferredMapCenter';
import type { Route } from '../types/route';

type ViewMode = 'map' | 'list';

const ROUTES_SOURCE_ID = 'browse-routes';
const CLUSTER_LAYER_ID = 'browse-routes-clusters';
const UNCLUSTERED_LAYER_ID = 'browse-routes-unclustered';
const BROWSE_PHOTOS_SOURCE_ID = 'browse-photos-source';
const BROWSE_PHOTOS_LAYER_ID = 'browse-photos-layer';
/** When true, only show pins for photos that have a valid thumbnail (hide default-pin-only). Toggle for UX filter later. */
const BROWSE_PHOTOS_HIDE_PINS_WITHOUT_THUMBNAIL = true;
/**
 * Icon size for browse-photos pins by zoom level.
 *
 * How it works:
 * - BROWSE_PHOTOS_ZOOM_SIZE is a list of [zoom, size] pairs: at that zoom, the pin is drawn at (size × base size).
 * - Base size is 1 (44px native). So size 2 = 88px, 4 = 176px, etc.
 * - iconSizeAtZoom(zoom) does linear interpolation between the pairs: for zoom between z0 and z1,
 *   size = s0 + (s1 - s0) * (zoom - z0) / (z1 - z0).
 *
 * How to adjust:
 * - Bigger steps / more dramatic zoom: use a wider size range (e.g. [8, 0.5] to [18, 3] so zooming in
 *   makes pins grow more noticeably).
 * - Softer curve: add more [zoom, size] pairs so size changes more gradually across zoom.
 * - Stronger “pop” when zoomed in: use larger sizes at high zoom (e.g. [20, 4] or [22, 6]) so pins
 *   stay small until you zoom in, then get clearly bigger.
 */
const BROWSE_PHOTOS_ZOOM_SIZE: [number, number][] = [
  [12, 0.5],
  [16, 2],
  [24, 15],
  
];
function iconSizeAtZoom(zoom: number): number {
  if (zoom <= BROWSE_PHOTOS_ZOOM_SIZE[0][0]) return BROWSE_PHOTOS_ZOOM_SIZE[0][1];
  for (let i = 0; i < BROWSE_PHOTOS_ZOOM_SIZE.length - 1; i++) {
    const [z0, s0] = BROWSE_PHOTOS_ZOOM_SIZE[i];
    const [z1, s1] = BROWSE_PHOTOS_ZOOM_SIZE[i + 1];
    if (zoom <= z1) return s0 + ((s1 - s0) * (zoom - z0)) / (z1 - z0);
  }
  return BROWSE_PHOTOS_ZOOM_SIZE[BROWSE_PHOTOS_ZOOM_SIZE.length - 1][1];
}
const CLUSTER_STACK_SIZE = 44;
const CLUSTER_STACK_OFFSET = 5;
const CLUSTER_STACK_MAX_IMAGES = 5;

function boundsToBbox(bounds: maplibregl.LngLatBounds): string {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return [sw.lng, sw.lat, ne.lng, ne.lat].join(',');
}

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function pointCoordinates(geom: GeoJSON.Geometry): [number, number] | null {
  if (geom.type === 'Point' && geom.coordinates && geom.coordinates.length >= 2) {
    return [geom.coordinates[0], geom.coordinates[1]];
  }
  return null;
}

/** Geographic centroid of leaf points; stable across zoom so markers do not jump. */
function computeClusterCentroid(coords: [number, number][]): [number, number] | null {
  if (coords.length === 0) return null;
  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of coords) {
    sumLng += lng;
    sumLat += lat;
  }
  return [sumLng / coords.length, sumLat / coords.length];
}

function buildRoutesGeoJSON(routes: Route[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const route of routes) {
    const coords = route.route_geometry?.coordinates;
    if (!coords || coords.length === 0) continue;
    const [lng, lat] = coords[0];
    features.push({
      type: 'Feature',
      properties: {
        routeId: route.id,
        slug: route.slug,
        firstPhotoId: route.first_photo_id ?? null,
      },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    });
  }
  return { type: 'FeatureCollection', features };
}

function buildPhotosGeoJSON(photos: PhotoBrowseItem[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const p of photos) {
    const loc = p.location;
    if (!loc || loc.type !== 'Point' || !loc.coordinates?.length) continue;
    const [lng, lat] = loc.coordinates;
    features.push({
      type: 'Feature',
      properties: { photoId: p.id, caption: p.caption ?? '', userName: p.user.name },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Stacked thumbnails for a route cluster; first route on top. */
function createRouteClusterStackElement(
  entries: { slug: string; firstPhotoId: string | null }[],
  thumbnailUrls: Record<string, string>,
  onClick: () => void
): HTMLElement {
  const size = CLUSTER_STACK_SIZE;
  const container = document.createElement('div');
  container.className = 'cluster-stack-pins';
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText = [
    `position: relative; width: ${size + (CLUSTER_STACK_MAX_IMAGES - 1) * CLUSTER_STACK_OFFSET}px;`,
    `height: ${size + (CLUSTER_STACK_MAX_IMAGES - 1) * CLUSTER_STACK_OFFSET}px;`,
    'cursor: pointer;',
  ].join(' ');
  container.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  const list = entries.slice(0, CLUSTER_STACK_MAX_IMAGES);
  list.forEach((entry, i) => {
    const el = document.createElement('div');
    el.style.cssText = [
      'position: absolute;',
      `left: ${i * CLUSTER_STACK_OFFSET}px; top: ${i * CLUSTER_STACK_OFFSET}px;`,
      `width: ${size}px; height: ${size}px;`,
      'border: 2px solid #fff; border-radius: 50%;',
      'box-shadow: 0 1px 3px rgba(0,0,0,0.3);',
      'overflow: hidden;',
      `z-index: ${list.length - i};`,
    ].join(' ');
    const url = entry.firstPhotoId ? thumbnailUrls[entry.firstPhotoId] : null;
    if (url) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = url;
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
      el.appendChild(img);
    } else {
      el.style.background = '#2563eb';
    }
    container.appendChild(el);
  });
  return container;
}

export function Browse() {
  const navigate = useNavigate();
  const mapContext = useMapContext();
  const { isAuthenticated } = useAuth();
  const { center: mapCenter, zoom: mapZoom } = usePreferredMapCenter();
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => getWelcomeDismissed());
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [routes, setRoutes] = useState<Route[]>([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [tagsFilter, setTagsFilter] = useState('');
  const [mapBbox, setMapBbox] = useState<string | null>(null);
  /** Photos in viewport for browse-photos mode (GET /v1/photos?bbox=). PRD v6 Step 3.1. */
  const [browsePhotos, setBrowsePhotos] = useState<PhotoBrowseItem[]>([]);
  const browsePhotosRef = useRef<PhotoBrowseItem[]>([]);
  const [browsePhotoThumbnailUrls, setBrowsePhotoThumbnailUrls] = useState<Record<string, string>>({});
  const browsePhotoThumbnailUrlsRef = useRef<Record<string, string>>({});
  /** Ref for focus return when closing photo lightbox (Step 3.2). */
  const mapFocusRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const clusterMarkersRef = useRef<maplibregl.Marker[]>([]);
  const clusterUpdateRunRef = useRef(0);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const thumbnailUrlsRef = useRef<Record<string, string>>({});
  const listPage = useRef(1);
  const [filtersOverlayOpen, setFiltersOverlayOpen] = useState(false);
  const [listOverlayOpen, setListOverlayOpen] = useState(true);
  /** Temporary: open BottomDrawer for Step 2.1 verification; remove when route view/create use it. */
  const [demoDrawerOpen, setDemoDrawerOpen] = useState(false);
  /** Photo selected for lightbox (e.g. from pin click in Phase 3). Step 2.3: reuse PhotoGallery for single-photo view. */
  const [selectedPhotoForLightbox, setSelectedPhotoForLightbox] = useState<{
    id: string;
    caption: string | null;
    userName?: string;
    routeSlugs?: { slug: string; title?: string }[];
  } | null>(null);
  const filtersButtonRef = useRef<HTMLButtonElement>(null);
  const routesButtonRef = useRef<HTMLButtonElement>(null);
  const filtersOverlayRef = useRef<HTMLDivElement>(null);
  const listOverlayRef = useRef<HTMLDivElement>(null);

  useFocusTrap(filtersOverlayRef, { active: filtersOverlayOpen, returnFocusRef: filtersButtonRef });
  useFocusTrap(listOverlayRef, { active: listOverlayOpen, returnFocusRef: routesButtonRef });

  const routesWithPhoto = useMemo(
    () => routes.filter((r) => r.first_photo_id),
    [routes]
  );

  useEffect(() => {
    if (routesWithPhoto.length === 0) return;
    let cancelled = false;
    const seen = new Set<string>();
    routesWithPhoto.forEach((r) => {
      const id = r.first_photo_id as string;
      if (seen.has(id)) return;
      seen.add(id);
      fetchPhotoImageBlob(id, 'thumbnail')
        .then((blob) => {
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          setThumbnailUrls((prev) => {
            const next = { ...prev, [id]: url };
            thumbnailUrlsRef.current = next;
            return next;
          });
        })
        .catch(() => {
          if (cancelled) return;
          setThumbnailUrls((prev) => ({ ...prev, [id]: '' }));
        });
    });
    return () => {
      cancelled = true;
      Object.values(thumbnailUrlsRef.current).forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
      thumbnailUrlsRef.current = {};
    };
  }, [routesWithPhoto]);

  /** Photos to show on map: all, or only those with valid thumbnail when BROWSE_PHOTOS_HIDE_PINS_WITHOUT_THUMBNAIL. */
  const photosToShowOnMap = useMemo(() => {
    if (!BROWSE_PHOTOS_HIDE_PINS_WITHOUT_THUMBNAIL) return browsePhotos;
    return browsePhotos.filter((p) => !!browsePhotoThumbnailUrls[p.id]);
  }, [browsePhotos, browsePhotoThumbnailUrls]);

  /** Fetch thumbnail blobs for browse-photos pins; object URLs keyed by photo id. */
  useEffect(() => {
    if (browsePhotos.length === 0) return;
    let cancelled = false;
    const seen = new Set<string>();
    browsePhotos.forEach((p) => {
      const id = p.id;
      if (seen.has(id)) return;
      seen.add(id);
      fetchPhotoImageBlob(id, 'thumbnail')
        .then((blob) => {
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          setBrowsePhotoThumbnailUrls((prev) => {
            const next = { ...prev, [id]: url };
            browsePhotoThumbnailUrlsRef.current = next;
            return next;
          });
        })
        .catch(() => {
          if (cancelled) return;
          setBrowsePhotoThumbnailUrls((prev) => ({ ...prev, [id]: '' }));
        });
    });
    return () => {
      cancelled = true;
      Object.values(browsePhotoThumbnailUrlsRef.current).forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
      browsePhotoThumbnailUrlsRef.current = {};
    };
  }, [browsePhotos]);

  const fetchList = useCallback(() => {
    setLoading(true);
    getBrowseRoutes({
      page: listPage.current,
      per_page: 20,
      sort: 'created_at',
      tags: tagsFilter.trim() || undefined,
    })
      .then((res) => {
        setRoutes(res.routes);
        setPagination(res.pagination);
      })
      .catch(() => {
        setRoutes([]);
        setPagination((p) => ({ ...p, total: 0 }));
      })
      .finally(() => setLoading(false));
  }, [tagsFilter]);

  const [bboxTooLarge, setBboxTooLarge] = useState(false);

  const fetchPhotosInBbox = useCallback((bbox: string) => {
    setLoading(true);
    setBboxTooLarge(false);
    getPhotosInBbox(bbox, 1, 50)
      .then((res) => {
        setBrowsePhotos(res.photos);
      })
      .catch((err: unknown) => {
        const msg =
          err &&
          typeof err === 'object' &&
          'response' in err &&
          (err as { response?: { data?: { detail?: { message?: string } } } }).response?.data?.detail?.message;
        const isBboxTooLarge =
          (err as { response?: { status?: number } })?.response?.status === 400 &&
          (typeof msg === 'string' && msg.toLowerCase().includes('bounding box'));
        if (isBboxTooLarge) {
          setBboxTooLarge(true);
        } else {
          setBrowsePhotos([]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const fetchMap = useCallback((bbox: string) => {
    setLoading(true);
    setBboxTooLarge(false);
    getBrowseRoutes({
      bbox,
      per_page: 50,
      sort: 'created_at',
      tags: tagsFilter.trim() || undefined,
    })
      .then((res) => {
        setRoutes(res.routes);
        setPagination(res.pagination);
      })
      .catch((err: unknown) => {
        const msg =
          err &&
          typeof err === 'object' &&
          'response' in err &&
          (err as { response?: { data?: { error?: { message?: string }; detail?: { message?: string } } } }).response?.data?.error?.message;
        const isBboxTooLarge =
          (err as { response?: { status?: number } })?.response?.status === 400 &&
          (typeof msg === 'string' && msg.toLowerCase().includes('bounding box'));
        if (isBboxTooLarge) {
          setBboxTooLarge(true);
          // keep previous routes so markers stay visible
        } else {
          setRoutes([]);
          setPagination((p) => ({ ...p, total: 0 }));
        }
      })
      .finally(() => setLoading(false));
  }, [tagsFilter]);

  const debouncedMapBbox = useDebounce(mapBbox, 400);

  const isShellMap = !!mapContext;

  useEffect(() => {
    if (viewMode !== 'map' || !debouncedMapBbox) return;
    if (isShellMap) {
      fetchPhotosInBbox(debouncedMapBbox);
    } else {
      fetchMap(debouncedMapBbox);
    }
  }, [viewMode, debouncedMapBbox, isShellMap, fetchPhotosInBbox, fetchMap]);

  useEffect(() => {
    if (viewMode === 'list') {
      listPage.current = 1;
      fetchList();
    }
  }, [viewMode, fetchList]);

  useEffect(() => {
    if (!mapContext || !listOverlayOpen || isShellMap) return;
    listPage.current = 1;
    const id = setTimeout(() => fetchList(), 0);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch on mount when list open; fetchList would cause refetch on every tags change
  }, [mapContext, listOverlayOpen, isShellMap]);


  const addImagesToMap = useCallback((map: MapLibreMap) => {
    const defaultPin = createDefaultPinImageData();
    if (!map.getStyle()) return;
    if (!map.hasImage('default-pin')) {
      map.addImage('default-pin', defaultPin);
    }
    routesWithPhoto.forEach((r) => {
      const id = r.first_photo_id as string;
      const url = thumbnailUrlsRef.current[id];
      if (url) {
        const img = new Image();
        img.onload = () => {
          if (!map.getStyle()) return;
          try {
            if (map.hasImage(id)) map.removeImage(id);
            const pinData = imageToPinImageData(img);
            map.addImage(id, pinData);
          } catch {
            /* layer/source may be gone */
          }
        };
        img.src = url;
      } else {
        try {
          if (!map.hasImage(id)) map.addImage(id, defaultPin);
        } catch {
          /* ignore */
        }
      }
    });
  }, [routesWithPhoto]);

  /** Add pin images for browse-photos layer: default-pin + one per photo id (thumbnail or fallback). Uses MAP_PIN_RASTER_SIZE so zooming scales a higher-res bitmap. */
  const addBrowsePhotoImagesToMap = useCallback((map: MapLibreMap) => {
    const defaultPin = createDefaultPinImageData(MAP_PIN_RASTER_SIZE);
    if (!map.getStyle()) return;
    if (!map.hasImage('default-pin')) {
      map.addImage('default-pin', defaultPin);
    }
    browsePhotos.forEach((p) => {
      const id = p.id;
      const url = browsePhotoThumbnailUrlsRef.current[id];
      if (url) {
        const img = new Image();
        img.onload = () => {
          if (!map.getStyle()) return;
          try {
            if (map.hasImage(id)) map.removeImage(id);
            const pinData = imageToPinImageData(img, MAP_PIN_RASTER_SIZE);
            map.addImage(id, pinData);
          } catch {
            /* layer/source may be gone */
          }
        };
        img.src = url;
      } else {
        try {
          if (!map.hasImage(id)) map.addImage(id, defaultPin);
        } catch {
          /* ignore */
        }
      }
    });
  }, [browsePhotos]);

  useEffect(() => {
    browsePhotosRef.current = browsePhotos;
  }, [browsePhotos]);

  const updateClusterMarkers = useCallback((map: MapLibreMap) => {
    clusterMarkersRef.current.forEach((m) => {
      try {
        m.remove();
      } catch {
        /* ignore */
      }
    });
    clusterMarkersRef.current = [];

    if (!map.getSource(ROUTES_SOURCE_ID) || !map.getLayer(CLUSTER_LAYER_ID)) return;

    const source = map.getSource(ROUTES_SOURCE_ID) as maplibregl.GeoJSONSource;
    const getLeaves =
      source && typeof source.getClusterLeaves === 'function'
        ? (clusterId: number) => source.getClusterLeaves(clusterId, 100, 0)
        : () => Promise.resolve<GeoJSON.Feature<GeoJSON.Point>[]>([]);

    const clusterFeatures = map.queryRenderedFeatures({ layers: [CLUSTER_LAYER_ID] });
    const seenIds = new Set<number>();
    const dist2 = (a: [number, number], b: [number, number]) =>
      (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

    const runId = ++clusterUpdateRunRef.current;

    clusterFeatures.forEach((feature) => {
      const clusterId = feature.properties?.cluster_id as number | undefined;
      const fallbackCenter = pointCoordinates(feature.geometry as GeoJSON.Point);
      if (clusterId == null || !fallbackCenter) return;
      if (seenIds.has(clusterId)) return;
      seenIds.add(clusterId);

      getLeaves(clusterId).then((leaves) => {
        if (clusterUpdateRunRef.current !== runId) return;
        if (!map.getSource(ROUTES_SOURCE_ID)) return;
        const withCoords = leaves
          .map((f) => {
            const c = pointCoordinates(f.geometry as GeoJSON.Point);
            const props = f.properties as { slug?: string; firstPhotoId?: string | null };
            return c && props ? { slug: props.slug ?? '', firstPhotoId: props.firstPhotoId ?? null, coords: c } : null;
          })
          .filter((x): x is { slug: string; firstPhotoId: string | null; coords: [number, number] } => x !== null);
        const center = computeClusterCentroid(withCoords.map((x) => x.coords)) ?? fallbackCenter;
        withCoords.sort((a, b) => dist2(a.coords, center) - dist2(b.coords, center));
        const entries = withCoords.map((x) => ({ slug: x.slug, firstPhotoId: x.firstPhotoId }));

        const el = createRouteClusterStackElement(entries, thumbnailUrlsRef.current, () => {
          Promise.resolve(source.getClusterExpansionZoom(clusterId)).then((zoom) => {
            map.easeTo({ center, zoom, duration: 300 });
          });
        });
        const marker = new maplibregl.Marker({ element: el }).setLngLat(center).addTo(map);
        clusterMarkersRef.current.push(marker);
      });
    });
  }, []);

  const handleMapReady = useCallback((map: MapLibreMap) => {
    mapRef.current = map;
    setMapReady(true);
    const onMoveEnd = () => {
      const bounds = map.getBounds();
      setMapBbox(boundsToBbox(bounds));
    };
    map.on('moveend', onMoveEnd);
    map.once('load', () => {
      const bounds = map.getBounds();
      setMapBbox(boundsToBbox(bounds));
    });
  }, []);

  useEffect(() => {
    if (!mapContext) return;
    mapContext.onMapReady(handleMapReady);
  }, [mapContext, handleMapReady]);

  /** Create/teardown browse-photos layer only when show conditions or map readiness change. Keeps layer on map so zoom expression and pins don’t flicker. */
  useEffect(() => {
    const map = mapRef.current;
    const hasMapApi = map && typeof (map as MapLibreMap).getSource === 'function';
    const shouldShow = isShellMap && viewMode === 'map' && mapReady && hasMapApi;
    if (!shouldShow) {
      if (hasMapApi && (map as MapLibreMap).getSource(BROWSE_PHOTOS_SOURCE_ID)) {
        try {
          (map as MapLibreMap).removeLayer(BROWSE_PHOTOS_LAYER_ID);
          (map as MapLibreMap).removeSource(BROWSE_PHOTOS_SOURCE_ID);
        } catch {
          /* defensive teardown */
        }
      }
      return;
    }
    const mapApi = map as MapLibreMap;
    let zoomHandler: (() => void) | null = null;
    if (!mapApi.getSource(BROWSE_PHOTOS_SOURCE_ID)) {
      mapApi.addSource(BROWSE_PHOTOS_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      const defaultPin = createDefaultPinImageData(MAP_PIN_RASTER_SIZE);
      if (!mapApi.hasImage('default-pin')) {
        mapApi.addImage('default-pin', defaultPin);
      }
      mapApi.addLayer({
        id: BROWSE_PHOTOS_LAYER_ID,
        type: 'symbol',
        source: BROWSE_PHOTOS_SOURCE_ID,
        layout: {
          'icon-image': ['coalesce', ['get', 'photoId'], 'default-pin'],
          'icon-size': (PIN_ICON_SIZE / MAP_PIN_RASTER_SIZE) * iconSizeAtZoom(mapApi.getZoom()),
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });
      zoomHandler = () => {
        try {
          if (mapApi.getLayer(BROWSE_PHOTOS_LAYER_ID)) {
            const zoom = mapApi.getZoom();
            mapApi.setLayoutProperty(BROWSE_PHOTOS_LAYER_ID, 'icon-size', (PIN_ICON_SIZE / MAP_PIN_RASTER_SIZE) * iconSizeAtZoom(zoom));
          }
        } catch {
          /* layer/source may be gone */
        }
      };
      zoomHandler();
      mapApi.on('zoom', zoomHandler);
      mapApi.on('click', BROWSE_PHOTOS_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        const props = feature?.properties as { photoId?: string; caption?: string; userName?: string } | undefined;
        if (!props?.photoId) return;
        const photo = browsePhotosRef.current.find((p) => p.id === props.photoId);
        setSelectedPhotoForLightbox(
          photo
            ? {
                id: photo.id,
                caption: photo.caption ?? null,
                userName: photo.user.name,
                routeSlugs: photo.routes ?? [],
              }
            : {
                id: props.photoId,
                caption: props.caption ?? null,
                userName: props.userName,
                routeSlugs: [],
              }
        );
      });
    }
    return () => {
      if (zoomHandler) {
        try {
          mapApi.off('zoom', zoomHandler);
        } catch {
          /* ignore */
        }
      }
      try {
        if (mapApi.getLayer(BROWSE_PHOTOS_LAYER_ID)) mapApi.removeLayer(BROWSE_PHOTOS_LAYER_ID);
        if (mapApi.getSource(BROWSE_PHOTOS_SOURCE_ID)) mapApi.removeSource(BROWSE_PHOTOS_SOURCE_ID);
      } catch {
        /* defensive teardown */
      }
    };
  }, [isShellMap, viewMode, mapReady]);

  /** Update browse-photos source data when photos change. Does not remove the layer, so zoom and pins stay stable. */
  useEffect(() => {
    const map = mapRef.current;
    if (!isShellMap || !map?.getSource(BROWSE_PHOTOS_SOURCE_ID)) return;
    const source = map.getSource(BROWSE_PHOTOS_SOURCE_ID) as maplibregl.GeoJSONSource;
    if (source?.setData) {
      source.setData(buildPhotosGeoJSON(photosToShowOnMap));
    }
    addBrowsePhotoImagesToMap(map);
  }, [isShellMap, photosToShowOnMap, addBrowsePhotoImagesToMap]);

  /** When browse-photo thumbnails load, update pin images on the map. */
  useEffect(() => {
    const map = mapRef.current;
    if (!isShellMap || !map?.getSource(BROWSE_PHOTOS_SOURCE_ID)) return;
    addBrowsePhotoImagesToMap(map);
  }, [isShellMap, browsePhotoThumbnailUrls, addBrowsePhotoImagesToMap]);

  useEffect(() => {
    const map = mapRef.current;
    const hasMapApi = map && typeof (map as MapLibreMap).getSource === 'function';
    if (isShellMap) {
      /* In browse-photos mode we use photo layer only; do not add route layer. */
      return;
    }
    if (viewMode !== 'map' || !hasMapApi) {
      if (hasMapApi && (map as MapLibreMap).getSource(ROUTES_SOURCE_ID)) {
        clusterMarkersRef.current.forEach((m) => {
          try { m.remove(); } catch { /* ignore */ }
        });
        clusterMarkersRef.current = [];
        (map as MapLibreMap).removeLayer(UNCLUSTERED_LAYER_ID);
        (map as MapLibreMap).removeLayer(CLUSTER_LAYER_ID);
        (map as MapLibreMap).removeSource(ROUTES_SOURCE_ID);
      }
      return;
    }
    if (routes.length === 0) {
      if ((map as MapLibreMap).getSource(ROUTES_SOURCE_ID)) {
        clusterMarkersRef.current.forEach((m) => {
          try { m.remove(); } catch { /* ignore */ }
        });
        clusterMarkersRef.current = [];
        (map as MapLibreMap).removeLayer(UNCLUSTERED_LAYER_ID);
        (map as MapLibreMap).removeLayer(CLUSTER_LAYER_ID);
        (map as MapLibreMap).removeSource(ROUTES_SOURCE_ID);
      }
      return;
    }

    const mapApi = map as MapLibreMap;
    const geojson = buildRoutesGeoJSON(routes);
    if (!mapApi.getSource(ROUTES_SOURCE_ID)) {
      mapApi.addSource(ROUTES_SOURCE_ID, {
        type: 'geojson',
        data: geojson,
        cluster: true,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
        clusterRadius: CLUSTER_RADIUS,
        clusterMinPoints: CLUSTER_MIN_POINTS,
      });
      const defaultPin = createDefaultPinImageData();
      if (!mapApi.hasImage('default-pin')) {
        mapApi.addImage('default-pin', defaultPin);
      }
      routesWithPhoto.forEach((r) => {
        const id = r.first_photo_id as string;
        if (mapApi.hasImage(id)) return;
        try {
          mapApi.addImage(id, defaultPin);
        } catch {
          /* ignore */
        }
      });
      mapApi.addLayer({
        id: CLUSTER_LAYER_ID,
        type: 'circle',
        source: ROUTES_SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': 32,
          'circle-opacity': 0,
          'circle-color': '#2563eb',
        },
      });
      mapApi.addLayer({
        id: UNCLUSTERED_LAYER_ID,
        type: 'symbol',
        source: ROUTES_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['coalesce', ['get', 'firstPhotoId'], 'default-pin'],
          'icon-size': 1,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });
      mapApi.on('click', CLUSTER_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        if (!feature?.properties?.cluster_id) return;
        const src = mapApi.getSource(ROUTES_SOURCE_ID) as maplibregl.GeoJSONSource;
        if (!src?.getClusterExpansionZoom) return;
        const clusterId = feature.properties.cluster_id;
        Promise.resolve(src.getClusterExpansionZoom(clusterId)).then((zoom) => {
          const center = pointCoordinates(feature.geometry as GeoJSON.Point);
          if (center) mapApi.easeTo({ center, zoom, duration: 300 });
        });
      });
      mapApi.on('click', UNCLUSTERED_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        const slug = (feature?.properties as { slug?: string })?.slug;
        if (slug) navigate(`/routes/${slug}`);
      });
    } else {
      (mapApi.getSource(ROUTES_SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson);
    }

    addImagesToMap(mapApi);
    updateClusterMarkers(mapApi);

    const onIdle = () => updateClusterMarkers(mapApi);
    mapApi.on('idle', onIdle);
    mapApi.on('moveend', onIdle);
    mapApi.on('zoomend', onIdle);

    return () => {
      mapApi.off('idle', onIdle);
      mapApi.off('moveend', onIdle);
      mapApi.off('zoomend', onIdle);
      clusterMarkersRef.current.forEach((m) => {
        try { m.remove(); } catch { /* ignore */ }
      });
      clusterMarkersRef.current = [];
      try {
        if (mapApi.getLayer(UNCLUSTERED_LAYER_ID)) mapApi.removeLayer(UNCLUSTERED_LAYER_ID);
        if (mapApi.getLayer(CLUSTER_LAYER_ID)) mapApi.removeLayer(CLUSTER_LAYER_ID);
        if (mapApi.getSource(ROUTES_SOURCE_ID)) mapApi.removeSource(ROUTES_SOURCE_ID);
      } catch {
        /* defensive teardown */
      }
    };
  }, [isShellMap, viewMode, routes, routesWithPhoto, navigate, addImagesToMap, updateClusterMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource(ROUTES_SOURCE_ID)) return;
    addImagesToMap(map);
    updateClusterMarkers(map);
  }, [thumbnailUrls, addImagesToMap, updateClusterMarkers]);

  const handleListPageChange = useCallback((page: number) => {
    listPage.current = page;
    setLoading(true);
    getBrowseRoutes({
      page,
      per_page: 20,
      sort: 'created_at',
      tags: tagsFilter.trim() || undefined,
    })
      .then((res) => {
        setRoutes(res.routes);
        setPagination(res.pagination);
      })
      .finally(() => setLoading(false));
  }, [tagsFilter]);

  const handleApplyTags = useCallback(() => {
    if (mapRef.current && mapBbox) fetchMap(mapBbox);
    if (viewMode === 'list' || listOverlayOpen) fetchList();
  }, [viewMode, listOverlayOpen, fetchList, mapBbox, fetchMap]);

  const overlayMessage =
    (loading || bboxTooLarge)
      ? loading
        ? (isShellMap ? 'Loading photos…' : 'Loading routes…')
        : (isShellMap ? 'Zoom in to see photos in this area' : 'Zoom in to see routes in this area')
      : undefined;

  useEffect(() => {
    if (!isShellMap) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFiltersOverlayOpen(false);
        setListOverlayOpen(false);
        setDemoDrawerOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isShellMap]);

  useEffect(() => {
    if (!isShellMap && !listOverlayOpen) routesButtonRef.current?.focus();
  }, [listOverlayOpen, isShellMap]);

  const handleListRouteClick = useCallback((slug: string) => {
    setListOverlayOpen(false);
    navigate(`/routes/${slug}`);
  }, [navigate]);

  const floatingButtonStyle = {
    position: 'absolute' as const,
    zIndex: 100,
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.95)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    cursor: 'pointer' as const,
    pointerEvents: 'auto' as const,
  };

  const showWelcomeModal = !isAuthenticated && !welcomeDismissed;

  return (
    <div
      style={
        isShellMap
          ? { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }
          : { padding: '1rem', display: 'flex', flexDirection: 'column' }
      }
    >
      {isShellMap && (
        <div
          ref={mapFocusRef}
          tabIndex={-1}
          aria-label="Map"
          data-testid="map-focus-return"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', overflow: 'hidden' }}
        />
      )}
      <WelcomeModal open={showWelcomeModal} onDismiss={() => setWelcomeDismissed(true)} />
      {isShellMap && (
        <BottomDrawer
          open={demoDrawerOpen}
          onClose={() => setDemoDrawerOpen(false)}
          title="Drawer demo"
          peekContent="Step 2.1 verification — peek strip"
        >
          <div style={{ padding: '1rem' }}>
            <p style={{ marginBottom: '1rem' }}>
              This is the expanded scrollable body. The shared BottomDrawer will later show route view or create-route content here.
            </p>
            <p style={{ marginBottom: '1rem' }}>Use the ▲ button or click the peek bar to expand; ▼ to collapse; × or Escape to close.</p>
            {Array.from({ length: 12 }, (_, i) => (
              <p key={i} style={{ marginBottom: '0.5rem' }}>Line {i + 1} — scroll to confirm the body scrolls.</p>
            ))}
          </div>
        </BottomDrawer>
      )}
      {isShellMap && selectedPhotoForLightbox && (
        <PhotoGallery
          photos={[{ id: selectedPhotoForLightbox.id, caption: selectedPhotoForLightbox.caption }]}
          selectedPhotoId={selectedPhotoForLightbox.id}
          showGrid={false}
          lightboxContext={{
            user: selectedPhotoForLightbox.userName ? { id: '', name: selectedPhotoForLightbox.userName } : undefined,
            routes: selectedPhotoForLightbox.routeSlugs,
            onOpenRoute: selectedPhotoForLightbox.routeSlugs?.length
              ? (slug) => {
                  setSelectedPhotoForLightbox(null);
                  navigate(`/routes/${slug}`);
                }
              : undefined,
          }}
          onClose={() => setSelectedPhotoForLightbox(null)}
          returnFocusRef={mapFocusRef}
        />
      )}
      {isShellMap ? (
        <>
          <div style={{ position: 'absolute', top: '3.5rem', right: '5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', pointerEvents: 'auto', zIndex: 500 }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setDemoDrawerOpen(true)}
                style={{ ...floatingButtonStyle, flexShrink: 0 }}
                aria-label="Open drawer demo"
              >
                Drawer
              </button>
              <button
                ref={filtersButtonRef}
                type="button"
                onClick={() => setFiltersOverlayOpen(true)}
                style={{ ...floatingButtonStyle, flexShrink: 0 }}
                aria-label="Open filters"
              >
                Filters
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                setSelectedPhotoForLightbox({
                  id: 'demo-photo',
                  caption: 'Step 2.3 demo photo',
                  userName: 'Demo user',
                  routeSlugs: [{ slug: 'demo-route', title: 'Demo route' }],
                })
              }
              style={{ ...floatingButtonStyle, flexShrink: 0 }}
              aria-label="Open photo lightbox demo"
            >
              Photo
            </button>
          </div>
          {filtersOverlayOpen && (
            <>
              <div
                role="presentation"
                aria-hidden="true"
                style={{ position: 'absolute', inset: 0, zIndex: 301, background: 'rgba(0,0,0,0.3)', pointerEvents: 'auto' }}
                onClick={() => setFiltersOverlayOpen(false)}
              />
              <div
                ref={filtersOverlayRef}
                role="dialog"
                aria-modal="true"
                aria-label="Filter by tags"
                style={{
                  position: 'absolute',
                  top: '4rem',
                  right: '1rem',
                  zIndex: 302,
                  minWidth: 260,
                  padding: '1rem',
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  pointerEvents: 'auto',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>Filters</h3>
                  <button type="button" onClick={() => setFiltersOverlayOpen(false)} aria-label="Close">×</button>
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.875rem' }}>Tags</span>
                  <input
                    type="text"
                    value={tagsFilter}
                    onChange={(e) => setTagsFilter(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (handleApplyTags(), setFiltersOverlayOpen(false))}
                    placeholder="e.g. urban, night"
                    style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  />
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setFiltersOverlayOpen(false)}>Cancel</button>
                  <button
                    type="button"
                    onClick={() => { handleApplyTags(); setFiltersOverlayOpen(false); }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </>
          )}

          {overlayMessage && (
            <div
              style={{
                position: 'absolute',
                top: '5rem',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '0.25rem 0.5rem',
                background: 'rgba(255,255,255,0.9)',
                borderRadius: 4,
                fontSize: '0.875rem',
                pointerEvents: 'auto',
                zIndex: 100,
              }}
            >
              {overlayMessage}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                style={{
                  padding: '0.5rem 0.75rem',
                  fontWeight: viewMode === 'map' ? 'bold' : 'normal',
                  background: viewMode === 'map' ? '#e5e7eb' : 'transparent',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                }}
              >
                Map
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  padding: '0.5rem 0.75rem',
                  fontWeight: viewMode === 'list' ? 'bold' : 'normal',
                  background: viewMode === 'list' ? '#e5e7eb' : 'transparent',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                }}
              >
                List
              </button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem' }}>Tags:</span>
              <input
                type="text"
                value={tagsFilter}
                onChange={(e) => setTagsFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyTags()}
                placeholder="e.g. urban, night"
                style={{ padding: '0.35rem 0.5rem', width: '160px', border: '1px solid #d1d5db', borderRadius: '4px' }}
              />
              <button type="button" onClick={handleApplyTags} style={{ padding: '0.35rem 0.5rem' }}>Apply</button>
            </label>
          </div>

          {viewMode === 'map' && (
            <MapPanel overlay={overlayMessage}>
              <MapView
                center={mapCenter}
                zoom={mapZoom}
                style={{ width: '100%', height: '100%' }}
                onMapReady={handleMapReady}
              />
            </MapPanel>
          )}

          {viewMode === 'list' && (
            <div style={{ flex: 1, minHeight: 200, overflow: 'hidden' }}>
              <RouteList
                routes={routes}
                pagination={pagination}
                loading={loading}
                onPageChange={handleListPageChange}
                onRouteClick={handleListRouteClick}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
