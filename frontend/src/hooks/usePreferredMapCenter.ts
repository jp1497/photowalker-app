/** Resolve map center: user's stored location, or browser geolocation (and save to profile if logged in), or fallback. */
import { useEffect, useState } from 'react';
import { authStore } from '../store/authStore';
import { updateMe } from '../api/auth';

const FALLBACK_CENTER: [number, number] = [-122.42, 37.78];
const DEFAULT_ZOOM = 14;

export interface UsePreferredMapCenterResult {
  center: [number, number];
  zoom: number;
  loading: boolean;
}

/**
 * Returns map center and zoom for initial map view.
 * - If user has default_map_lat/lon stored, use that.
 * - Else request browser geolocation; on success use it and (if logged in) save to profile.
 * - On geolocation error or deny, use fallback (San Francisco).
 */
export function usePreferredMapCenter(): UsePreferredMapCenterResult {
  const user = authStore((s) => s.user);
  const setUser = authStore((s) => s.setUser);
  const [center, setCenter] = useState<[number, number]>(FALLBACK_CENTER);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      const u = authStore.getState().user;
      if (u?.default_map_lat != null && u?.default_map_lon != null) {
        const lon = Number(u.default_map_lon);
        const lat = Number(u.default_map_lat);
        if (Number.isFinite(lon) && Number.isFinite(lat) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          if (!cancelled) {
            setCenter([lon, lat]);
            setLoading(false);
          }
          return;
        }
      }

      if (!navigator.geolocation) {
        if (!cancelled) {
          setCenter(FALLBACK_CENTER);
          setLoading(false);
        }
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lon = position.coords.longitude;
          const lat = position.coords.latitude;
          if (cancelled) return;
          setCenter([lon, lat]);
          setLoading(false);
          const currentUser = authStore.getState().user;
          if (currentUser) {
            try {
              const updated = await updateMe({ default_map_lat: lat, default_map_lon: lon });
              if (!cancelled) setUser(updated);
            } catch {
              // ignore save failure; we still have the center
            }
          }
        },
        () => {
          if (!cancelled) {
            setCenter(FALLBACK_CENTER);
            setLoading(false);
          }
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.default_map_lat, user?.default_map_lon, setUser]);

  return { center, zoom: DEFAULT_ZOOM, loading };
}
