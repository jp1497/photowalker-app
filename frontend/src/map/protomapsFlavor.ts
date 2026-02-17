/**
 * Custom Protomaps Flavor for prettymaps-like colors.
 * Used by the programmatic style builder for the vector basemap.
 * @see Design/PRD_v5.md Appendix: Prettymaps-Like Flavor
 */
import { namedFlavor, type Flavor } from '@protomaps/basemaps';

export const prettyMapsLikeFlavor: Flavor = {
  ...namedFlavor('light'),
  background: '#F2F4CB',
  earth: '#F2F4CB',
  buildings: '#7B534E',
  water: '#a8e1e6',
  park_a: '#8BB174',
  park_b: '#D0F1BF',
  wood_a: '#64B96A',
  wood_b: '#8BB174',
  beach: '#FCE19C',
  sand: '#FCE19C',
  highway: '#2F3737',
  highway_casing_early: '#475657',
  highway_casing_late: '#475657',
  major: '#2F3737',
  major_casing_early: '#475657',
  major_casing_late: '#475657',
  minor_a: '#2F3737',
  minor_b: '#2F3737',
  minor_casing: '#475657',
  link: '#2F3737',
  link_casing: '#475657',
  pedestrian: '#2F3737',
  other: '#2F3737',
};
