/**
 * Map style configuration for OpenFreeMap vector tiles.
 * OpenFreeMap provides free vector tiles with no API key required.
 * @see https://openfreemap.org/quick_start/
 */

import type { StyleSpecification, SymbolLayerSpecification, FilterSpecification } from 'maplibre-gl';
import {
  POI_MIN_ZOOM,
  POI_WIDE_MIN_ZOOM,
  POI_WIDE_MAX_ZOOM,
  createPoiZoomedFilter,
  createPoiWideFilter,
} from './poiConfig';

export type MapStyleId = 'positron' | 'bright' | 'liberty' | '3d';

export interface MapStyleConfig {
  id: MapStyleId;
  name: string;
  url: string;
  description: string;
}

/**
 * Available map styles from OpenFreeMap.
 * To add a new style: add its id to MapStyleId, then add its config here.
 */
export const MAP_STYLES: Record<MapStyleId, MapStyleConfig> = {
  positron: {
    id: 'positron',
    name: 'Positron',
    url: 'https://tiles.openfreemap.org/styles/positron',
    description: 'Light, minimalist style',
  },
  bright: {
    id: 'bright',
    name: 'Bright',
    url: 'https://tiles.openfreemap.org/styles/bright',
    description: 'Colorful, detailed style',
  },
  liberty: {
    id: 'liberty',
    name: 'Liberty',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    description: 'OpenStreetMap-like style',
  },
  '3d': {
    id: '3d',
    name: '3D',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    description: '3D buildings style (uses Liberty with 3D rendering)',
  },
};

/** All available styles as an array (useful for UI selectors). */
export const MAP_STYLE_LIST = Object.values(MAP_STYLES);

/**
 * Currently selected map style.
 * Change this value to switch the basemap across the app.
 */
export const CURRENT_MAP_STYLE: MapStyleId = 'liberty';

/** Returns the style URL for the currently selected style. */
export function getMapStyleUrl(): string {
  return MAP_STYLES[CURRENT_MAP_STYLE].url;
}

/** Returns the style URL for a specific style id. */
export function getMapStyleUrlById(id: MapStyleId): string {
  return MAP_STYLES[id].url;
}

/** Whether to apply custom POI filtering. Set to false to use default OpenFreeMap POIs. */
export const CUSTOMIZE_POIS = true;

/**
 * Fetches the base style and applies custom POI layers.
 * Returns a customized style with two POI sections: wide zoom (rank > 3 + important classes) and zoomed-in (rank > 20).
 */
export async function getCustomizedStyle(
  styleId: MapStyleId = CURRENT_MAP_STYLE
): Promise<StyleSpecification> {
  const url = MAP_STYLES[styleId].url;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch map style: ${response.status}`);
  }
  const style: StyleSpecification = await response.json();

  if (!CUSTOMIZE_POIS) {
    return style;
  }

  // Remove existing POI layers (they start with "poi")
  const filteredLayers = style.layers.filter(
    (layer) => !layer.id.startsWith('poi')
  );

  // Find where to insert POI layers (before place labels, after roads)
  const placeIndex = filteredLayers.findIndex((l) =>
    l.id.startsWith('place_')
  );
  const insertIndex = placeIndex > 0 ? placeIndex : filteredLayers.length;

  const poiLayout: SymbolLayerSpecification['layout'] = {
    'icon-image': '{class}_11',
    'icon-size': 1,
    'text-field': ['get', 'name'] as unknown as string,
    'text-font': ['Noto Sans Regular'],
    'text-size': 11,
    'text-offset': [0, 1.2] as [number, number],
    'text-anchor': 'top' as const,
    'text-optional': true,
    'icon-allow-overlap': false,
    'text-allow-overlap': false,
  };
  const poiPaint: SymbolLayerSpecification['paint'] = {
    'text-color': '#1a5fb4',
    'text-halo-color': 'rgba(255, 255, 255, 0.9)',
    'text-halo-width': 1.5,
  };

  // Wide zoom: rank > 3 or important classes (minzoom–maxzoom)
  const poiWide: SymbolLayerSpecification = {
    id: 'poi_wide',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'poi',
    minzoom: POI_WIDE_MIN_ZOOM,
    maxzoom: POI_WIDE_MAX_ZOOM,
    filter: createPoiWideFilter() as FilterSpecification,
    layout: { ...poiLayout, 'icon-size': 0.85, 'text-size': 10 },
    paint: poiPaint,
  };

  // Zoomed-in: rank > 20 only (from POI_MIN_ZOOM up)
  const poiZoomed: SymbolLayerSpecification = {
    id: 'poi_prominent',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'poi',
    minzoom: POI_MIN_ZOOM,
    filter: createPoiZoomedFilter() as FilterSpecification,
    layout: poiLayout,
    paint: poiPaint,
  };

  filteredLayers.splice(insertIndex, 0, poiWide, poiZoomed);
  style.layers = filteredLayers;

  return style;
}
