/** Turf.js helpers. Validate LineString, distance in meters. */
import { lineString } from '@turf/helpers';
import length from '@turf/length';
import type { LineStringCoords } from '../types/route';

const MIN_POINTS = 2;

export interface ValidationResult {
  valid: boolean;
  error?: string;
  distanceMeters?: number;
}

/**
 * Validate LineString coordinates: at least 2 points, distance > 0 (no duplicate points).
 * Returns validation result with optional distance in meters.
 */
export function validateRouteGeometry(coordinates: LineStringCoords): ValidationResult {
  if (!Array.isArray(coordinates) || coordinates.length < MIN_POINTS) {
    return { valid: false, error: `Route must have at least ${MIN_POINTS} points` };
  }
  for (let i = 0; i < coordinates.length; i++) {
    const pt = coordinates[i];
    if (!Array.isArray(pt) || pt.length < 2 || typeof pt[0] !== 'number' || typeof pt[1] !== 'number') {
      return { valid: false, error: `Point ${i} must be [lon, lat]` };
    }
    const [lon, lat] = pt;
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
      return { valid: false, error: `Point ${i}: lon in [-180,180], lat in [-90,90]` };
    }
  }
  const line = lineString(coordinates);
  const distanceMeters = length(line, { units: 'meters' });
  if (distanceMeters <= 0) {
    return { valid: false, error: 'Route distance must be greater than 0' };
  }
  return { valid: true, distanceMeters };
}
