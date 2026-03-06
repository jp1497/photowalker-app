/** Context for nav panel open states: routes panel, photos panel, upload drawer. */
import { createContext, useContext, useState, type ReactNode } from 'react';

export interface RoutesPanelContextValue {
  routesPanelOpen: boolean;
  setRoutesPanelOpen: (open: boolean) => void;
  photosPanelOpen: boolean;
  setPhotosPanelOpen: (open: boolean) => void;
  uploadDrawerOpen: boolean;
  setUploadDrawerOpen: (open: boolean) => void;
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
  const [photosPanelOpen, setPhotosPanelOpen] = useState(false);
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  return (
    <RoutesPanelContext.Provider
      value={{
        routesPanelOpen,
        setRoutesPanelOpen,
        photosPanelOpen,
        setPhotosPanelOpen,
        uploadDrawerOpen,
        setUploadDrawerOpen,
      }}
    >
      {children}
    </RoutesPanelContext.Provider>
  );
}
