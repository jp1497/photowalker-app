/** Reusable map UI container: consistent height, border, radius, overflow. Optional overlay for messages. */
import type { ReactNode } from 'react';

const DEFAULT_HEIGHT = 320;

export interface MapPanelProps {
  /** Height in pixels. Default 320 to match route detail and browse. */
  height?: number;
  /** Message or content shown above the map (e.g. loading, "zoom in"). */
  overlay?: ReactNode;
  /** Map component(s), e.g. MapView or MapPicker. */
  children: ReactNode;
}

export function MapPanel({ height = DEFAULT_HEIGHT, overlay, children }: MapPanelProps) {
  return (
    <div
      style={{
        position: 'relative',
        height,
        border: '1px solid #ccc',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      {children}
      {overlay != null && overlay !== false && (
        <div
          style={{
            position: 'absolute',
            top: '0.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '0.25rem 0.5rem',
            background: 'rgba(255,255,255,0.9)',
            borderRadius: 4,
            fontSize: '0.875rem',
            pointerEvents: 'none',
          }}
        >
          {overlay}
        </div>
      )}
    </div>
  );
}
