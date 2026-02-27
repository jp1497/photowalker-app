/** Context for left Explore routes panel open state. Drawer menu opens it. */
import { createContext, useContext, useState, type ReactNode } from 'react';

export interface RoutesPanelContextValue {
  routesPanelOpen: boolean;
  setRoutesPanelOpen: (open: boolean) => void;
}

const RoutesPanelContext = createContext<RoutesPanelContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components -- hook and provider are co-located by design.
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
