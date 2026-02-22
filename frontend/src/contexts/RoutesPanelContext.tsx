/** Context for left Explore routes panel open state. Drawer menu opens it; Phase 4 will replace placeholder with full panel. */
import { createContext, useContext, useState, type ReactNode } from 'react';

export interface RoutesPanelContextValue {
  routesPanelOpen: boolean;
  setRoutesPanelOpen: (open: boolean) => void;
}

const RoutesPanelContext = createContext<RoutesPanelContextValue | null>(null);

export function useRoutesPanel(): RoutesPanelContextValue | null {
  return useContext(RoutesPanelContext);
}

export interface RoutesPanelProviderProps {
  children: ReactNode;
}

export function RoutesPanelProvider({ children }: RoutesPanelProviderProps) {
  const [routesPanelOpen, setRoutesPanelOpen] = useState(false);
  return (
    <RoutesPanelContext.Provider value={{ routesPanelOpen, setRoutesPanelOpen }}>
      {children}
    </RoutesPanelContext.Provider>
  );
}
