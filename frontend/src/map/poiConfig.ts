/**
 * POI (Point of Interest) configuration for the map.
 * Two sections: wide zoom (rank > 3 + important categories) and zoomed-in (rank > 20).
 *
 * OpenMapTiles POI schema: https://openmaptiles.org/schema/#poi
 * Rank: higher = more prominent (e.g. major landmarks have higher rank).
 */

// --- Zoomed-in section (high detail) ---

/** Zoom level at which the "zoomed-in" POI layer appears (rank > 20). */
export const POI_MIN_ZOOM = 15;

/** Minimum rank for zoomed-in view (POIs with rank > this are shown). */
export const POI_RANK_MIN = 20;

/**
 * MapLibre filter: show POIs where rank > POI_RANK_MIN (zoomed-in layer).
 */
export function createPoiZoomedFilter(): unknown[] {
  return ['>', ['get', 'rank'], POI_RANK_MIN];
}

// --- Wide zoom section (overview) ---

/** Zoom level at which the "wide" POI layer appears. */
export const POI_WIDE_MIN_ZOOM = 11;

/** Maximum zoom for the wide layer; above this the zoomed-in layer takes over. */
export const POI_WIDE_MAX_ZOOM = 14;

/** Minimum rank for wide view (rank > this shown at wider zoom). */
export const POI_WIDE_RANK_MIN = 3;

/**
 * Important POI classes always shown at wide zoom (even if rank <= POI_WIDE_RANK_MIN).
 * @see https://openmaptiles.org/schema/#poi
 */
export const POI_WIDE_IMPORTANT_CLASSES: string[] = [
  'townhall',
  'monument',
  'castle',
  'place_of_worship',
  'attraction',
  'museum',
  'viewpoint',
  'park',
];

/**
 * MapLibre filter for wide zoom: rank > POI_WIDE_RANK_MIN OR class in POI_WIDE_IMPORTANT_CLASSES.
 */
export function createPoiWideFilter(): unknown[] {
  const rankFilter: unknown[] = ['>', ['get', 'rank'], POI_WIDE_RANK_MIN];
  const classFilter: unknown[] = [
    'in',
    ['get', 'class'],
    ['literal', POI_WIDE_IMPORTANT_CLASSES],
  ];
  return ['any', rankFilter, classFilter];
}
