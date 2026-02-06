/** Unit tests for geometry validation (Turf). */
import { describe, expect, it } from 'vitest';
import { validateRouteGeometry } from './geometry';

describe('validateRouteGeometry', () => {
  it('returns valid and distance for at least 2 distinct points', () => {
    const coords: [number, number][] = [
      [-122.4, 37.8],
      [-122.41, 37.81],
    ];
    const result = validateRouteGeometry(coords);
    expect(result.valid).toBe(true);
    expect(result.distanceMeters).toBeGreaterThan(0);
  });

  it('returns error when fewer than 2 points', () => {
    const result = validateRouteGeometry([[-122.4, 37.8]]);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/at least 2 points/);
  });

  it('returns error when distance is 0 (duplicate points)', () => {
    const coords: [number, number][] = [
      [-122.4, 37.8],
      [-122.4, 37.8],
    ];
    const result = validateRouteGeometry(coords);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/greater than 0/);
  });
});
