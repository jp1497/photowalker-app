/** Reusable map UI container: consistent height, border, radius, overflow. Optional overlay for messages. */
import type { ReactNode } from 'react';

const DEFAULT_HEIGHT = 320;

export interface MapPanelProps {
  /** When true, container fills parent (height 100%); parent must provide height. */
  fill?: boolean;
  /** Height in pixels when fill is false. Default 320. */
  height?: number;
  /** Message or content shown above the map (e.g. loading, "zoom in"). */
  overlay?: ReactNode;
  /** Map component(s), e.g. MapView or MapPicker. */
  children: ReactNode;
}

export function MapPanel({ fill = false, height = DEFAULT_HEIGHT, overlay, children }: MapPanelProps) {
  return (
    <div
      style={{
        position: 'relative',
        ...(fill ? { height: '100%', minHeight: 0 } : { height }),
        border: fill ? undefined : '1px solid #ccc',
        borderRadius: fill ? 0 : 4,
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
