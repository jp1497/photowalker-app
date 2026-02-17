/**
 * Programmatic MapLibre style for Protomaps vector basemap.
 * Uses Tile API (TileJSON); requires VITE_PROTOMAPS_API_KEY.
 * @see Design/PRD_v5.md FR-M5, FR-M8
 */
import { layers } from '@protomaps/basemaps';
import type { StyleSpecification } from 'maplibre-gl';
import { prettyMapsLikeFlavor } from './protomapsFlavor';

const SOURCE_ID = 'protomaps';
const TILEJSON_BASE = 'https://api.protomaps.com/tiles/v4.json';
const GLYPHS_URL = 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';
const SPRITE_BASE = 'https://protomaps.github.io/basemaps-assets/sprites/v4/light';
const ATTRIBUTION =
  '<a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/**
 * Returns a MapLibre GL style (v8) for the Protomaps vector basemap with the custom prettymaps-like flavor.
 * Reads the API key from import.meta.env.VITE_PROTOMAPS_API_KEY.
 * @throws Error if VITE_PROTOMAPS_API_KEY is missing or empty
 */
export function getProtomapsStyle(): StyleSpecification {
  const apiKey = import.meta.env.VITE_PROTOMAPS_API_KEY;
  if (typeof apiKey !== 'string' || apiKey.trim() === '') {
    throw new Error(
      'VITE_PROTOMAPS_API_KEY is required for the map. Set it in .env.local (get a key at https://protomaps.com/account, free for non-commercial use).'
    );
  }

  const url = `${TILEJSON_BASE}?key=${encodeURIComponent(apiKey.trim())}`;

  const style: StyleSpecification = {
    version: 8,
    sources: {
      [SOURCE_ID]: {
        type: 'vector',
        url,
        attribution: ATTRIBUTION,
      },
    },
    layers: layers(SOURCE_ID, prettyMapsLikeFlavor, { lang: 'en' }),
    glyphs: GLYPHS_URL,
    sprite: SPRITE_BASE,
  };

  return style;
}
