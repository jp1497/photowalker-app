/**
 * Shared clustering config for map point layers (Browse routes, RouteView photos).
 * Same behaviour in both: aggressive clustering when zoomed out (one cluster),
 * uncluster above zoom 12, min 3 points per cluster.
 */
export const CLUSTER_MAX_ZOOM = 12;
export const CLUSTER_RADIUS = 80;
export const CLUSTER_MIN_POINTS = 3;
