/** Context for the currently highlighted route (Explore panel). Browse fades only when the highlighted layer is ready so there is no "faded gap" before pins appear. */
import { createContext, useContext } from 'react';

export interface HighlightedRouteContextValue {
  highlightedRouteSlug: string | null;
  /** True only after the highlighted-route layer has been added to the map (avoids fading before pins appear). */
  highlightedLayerReady: boolean;
}

export const HighlightedRouteContext = createContext<HighlightedRouteContextValue | null>(null);

export function useHighlightedRoute(): HighlightedRouteContextValue | null {
  return useContext(HighlightedRouteContext);
}
