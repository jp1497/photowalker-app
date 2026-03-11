/** Browse: map with photo pins (bbox fetch) or legacy list view. PRD v6 Step 3.1: browse-photos mode. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Map as MapLibreMap } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import { getBrowseRoutes } from '../api/routes';
import { fetchPhotoImageBlob, getMyPhotosInBbox, getPhotosInBbox } from '../api/photos';
import type { PhotoBrowseItem } from '../types/photo';
import { MapPanel } from '../components/map/MapPanel';
import { MapView } from '../components/map/MapView';
import { RouteList } from '../components/routes/RouteList';
import { useHighlightedRoute } from '../contexts/HighlightedRouteContext';
import { useMapContext } from '../contexts/MapContext';
import { useRoutesPanel } from '../contexts/RoutesPanelContext';
import { createPhotoCalloutElement, setCalloutThumbnail } from '../components/map/PhotoMarker';
import { getWelcomeDismissed } from '../components/common/welcomeStorage';
import { WelcomeModal } from '../components/common/WelcomeModal';
import { PhotoGallery } from '../components/photos/PhotoGallery';
import { useAuth } from '../hooks/useAuth';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { usePreferredMapCenter } from '../hooks/usePreferredMapCenter';
import type { Route } from '../types/route';

type ViewMode = 'map' | 'list';

const ROUTES_SOURCE_ID = 'browse-routes';
const ROUTES_LAYER_ID = 'browse-routes';
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
  const [myPhotosMode, setMyPhotosMode] = useState(false);
  const browsePhotosRef = useRef<PhotoBrowseItem[]>([]);
  const [browsePhotoThumbnailUrls, setBrowsePhotoThumbnailUrls] = useState<Record<string, string>>({});
  const browsePhotoThumbnailUrlsRef = useRef<Record<string, string>>({});
  /** Ref for focus return when closing photo lightbox (Step 3.2). */
  const mapFocusRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const browsePhotoMarkersRef = useRef<maplibregl.Marker[]>([]);
  const listPage = useRef(1);
  const [listOverlayOpen, setListOverlayOpen] = useState(true);
  /** Photo selected for lightbox (e.g. from pin click in Phase 3). Step 2.3: reuse PhotoGallery for single-photo view. */
  const [selectedPhotoForLightbox, setSelectedPhotoForLightbox] = useState<{
    id: string;
    caption: string | null;
    userName?: string;
    routeSlugs?: { slug: string; title?: string }[];
  } | null>(null);
  const routesButtonRef = useRef<HTMLButtonElement>(null);
  const listOverlayRef = useRef<HTMLDivElement>(null);

  useFocusTrap(listOverlayRef, { active: listOverlayOpen, returnFocusRef: routesButtonRef });

  const routesPanel = useRoutesPanel();
  const photoLibraryVersion = routesPanel?.photoLibraryVersion ?? 0;

  /** When photos are successfully uploaded, switch to My Photos mode so the user sees their new photos. */
  useEffect(() => {
    if (photoLibraryVersion === 0) return;
    setMyPhotosMode(true);
  }, [photoLibraryVersion]);

  const photosToShowOnMap = browsePhotos;

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
    const fetcher = myPhotosMode ? getMyPhotosInBbox : getPhotosInBbox;
    fetcher(bbox, 1, 50)
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
  }, [myPhotosMode]);

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
    if (isShellMap || myPhotosMode) {
      fetchPhotosInBbox(debouncedMapBbox);
    } else {
      fetchMap(debouncedMapBbox);
    }
  }, [viewMode, debouncedMapBbox, isShellMap, myPhotosMode, fetchPhotosInBbox, fetchMap, photoLibraryVersion]);

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


  useEffect(() => {
    browsePhotosRef.current = browsePhotos;
  }, [browsePhotos]);

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

  useHighlightedRoute();

  /** Create/teardown callout markers when the photo list or map readiness changes. */
  useEffect(() => {
    const map = mapRef.current;
    if (!isShellMap || !map) return;

    // Teardown previous markers
    browsePhotoMarkersRef.current.forEach((m) => {
      try { m.remove(); } catch { /* ignore */ }
    });
    browsePhotoMarkersRef.current = [];

    if (!mapReady) return;

    photosToShowOnMap.forEach((photo) => {
      const loc = photo.location;
      if (!loc || loc.type !== 'Point' || !loc.coordinates?.length) return;
      const [lng, lat] = loc.coordinates as [number, number];
      const thumbnailUrl = browsePhotoThumbnailUrlsRef.current[photo.id] || undefined;
      const el = createPhotoCalloutElement(() => {
        setSelectedPhotoForLightbox({
          id: photo.id,
          caption: photo.caption ?? null,
          userName: photo.user.name,
          routeSlugs: photo.routes ?? [],
        });
      }, thumbnailUrl);
      el.dataset.photoId = photo.id;
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(map);
      browsePhotoMarkersRef.current.push(marker);
    });

    return () => {
      browsePhotoMarkersRef.current.forEach((m) => {
        try { m.remove(); } catch { /* ignore */ }
      });
      browsePhotoMarkersRef.current = [];
    };
  }, [isShellMap, mapReady, photosToShowOnMap]);

  /** Update callout images in-place as thumbnails arrive (avoids full marker rebuild). */
  useEffect(() => {
    if (!isShellMap) return;
    browsePhotoMarkersRef.current.forEach((marker) => {
      const photoId = marker.getElement().dataset.photoId;
      if (!photoId) return;
      const url = browsePhotoThumbnailUrls[photoId];
      if (url) setCalloutThumbnail(marker.getElement(), url);
    });
  }, [isShellMap, browsePhotoThumbnailUrls]);

  useEffect(() => {
    const map = mapRef.current;
    const hasMapApi = map && typeof (map as MapLibreMap).getSource === 'function';
    if (isShellMap) {
      /* In browse-photos mode we use photo layer only; do not add route layer. */
      return;
    }
    if (viewMode !== 'map' || !hasMapApi) {
      if (hasMapApi && (map as MapLibreMap).getSource(ROUTES_SOURCE_ID)) {
        (map as MapLibreMap).removeLayer(ROUTES_LAYER_ID);
        (map as MapLibreMap).removeSource(ROUTES_SOURCE_ID);
      }
      return;
    }
    if (routes.length === 0) {
      if ((map as MapLibreMap).getSource(ROUTES_SOURCE_ID)) {
        (map as MapLibreMap).removeLayer(ROUTES_LAYER_ID);
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
      });
      mapApi.addLayer({
        id: ROUTES_LAYER_ID,
        type: 'circle',
        source: ROUTES_SOURCE_ID,
        paint: {
          'circle-radius': 8,
          'circle-color': '#2563eb',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      });
      mapApi.on('click', ROUTES_LAYER_ID, (e) => {
        const feature = e.features?.[0];
        const slug = (feature?.properties as { slug?: string })?.slug;
        if (slug) navigate(`/routes/${slug}`, { state: { openDrawer: true, preserveViewport: true } });
      });
    } else {
      (mapApi.getSource(ROUTES_SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson);
    }

    return () => {
      try {
        if (mapApi.getLayer(ROUTES_LAYER_ID)) mapApi.removeLayer(ROUTES_LAYER_ID);
        if (mapApi.getSource(ROUTES_SOURCE_ID)) mapApi.removeSource(ROUTES_SOURCE_ID);
      } catch {
        /* defensive teardown */
      }
    };
  }, [isShellMap, viewMode, routes, navigate]);

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
      if (e.key === 'Escape') setListOverlayOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isShellMap]);

  useEffect(() => {
    if (!isShellMap && !listOverlayOpen) routesButtonRef.current?.focus();
  }, [listOverlayOpen, isShellMap]);

  const handleListRouteClick = useCallback((slug: string) => {
    setListOverlayOpen(false);
    navigate(`/routes/${slug}`, { state: { openDrawer: true, preserveViewport: true } });
  }, [navigate]);

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
                  navigate(`/routes/${slug}`, { state: { openDrawer: true, preserveViewport: true } });
                }
              : undefined,
          }}
          onClose={() => setSelectedPhotoForLightbox(null)}
          returnFocusRef={mapFocusRef}
        />
      )}
      {isAuthenticated && (
        <div
          style={{
            position: isShellMap ? 'absolute' : 'relative',
            top: isShellMap ? '1rem' : undefined,
            left: isShellMap ? '50%' : undefined,
            transform: isShellMap ? 'translateX(-50%)' : undefined,
            zIndex: 100,
            display: 'flex',
            background: '#fff',
            borderRadius: 20,
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            pointerEvents: 'auto',
            marginBottom: isShellMap ? undefined : '0.5rem',
            alignSelf: isShellMap ? undefined : 'flex-start',
          }}
        >
          <button
            type="button"
            onClick={() => setMyPhotosMode(false)}
            aria-pressed={!myPhotosMode}
            style={{
              padding: '0.4rem 0.9rem',
              border: 'none',
              background: !myPhotosMode ? '#2563eb' : 'transparent',
              color: !myPhotosMode ? '#fff' : '#374151',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: !myPhotosMode ? 600 : 400,
            }}
          >
            All photos
          </button>
          <button
            type="button"
            onClick={() => setMyPhotosMode(true)}
            aria-pressed={myPhotosMode}
            style={{
              padding: '0.4rem 0.9rem',
              border: 'none',
              background: myPhotosMode ? '#2563eb' : 'transparent',
              color: myPhotosMode ? '#fff' : '#374151',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: myPhotosMode ? 600 : 400,
            }}
          >
            My photos
          </button>
        </div>
      )}
      {isShellMap ? (
        <>
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
