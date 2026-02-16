/** Context for the single app map instance owned by MapShell. */
import { createContext, useContext, type ReactNode } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';

export interface MapContextValue {
  /** The MapLibre instance when ready; null before load or after teardown. */
  map: MapLibreMap | null;
  /** Register a callback to run when the map is ready (or immediately if already ready). */
  onMapReady: (cb: (map: MapLibreMap) => void) => void;
}

const MapContext = createContext<MapContextValue | null>(null);

/* eslint-disable react-refresh/only-export-components -- hook and provider live together by design */
export function useMapContext(): MapContextValue | null {
  return useContext(MapContext);
}

export interface MapContextProviderProps {
  value: MapContextValue;
  children: ReactNode;
}

export function MapContextProvider({ value, children }: MapContextProviderProps) {
  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}
