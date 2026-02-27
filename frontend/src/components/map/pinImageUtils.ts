/** Shared pin image helpers for map symbol layers (route detail photos, browse routes). */

/** Base pin size; 44px meets WCAG minimum touch target (FR-U7). */
export const PIN_ICON_SIZE = 44;
/** Raster size for high-quality map pins. Larger than PIN_ICON_SIZE so the map scales a bigger bitmap when zooming. */
export const MAP_PIN_RASTER_SIZE = 256;
export const PIN_BORDER_WIDTH = 2;

/** Optional border override (e.g. golden border for highlighted-route layer). */
export interface PinBorderOptions {
  strokeStyle?: string;
  lineWidth?: number;
}

/**
 * Icon size multiplier for browse/highlighted photo pins by zoom level.
 * Linear interpolation between [zoom, size] pairs. Base size 1 = 44px; e.g. 2 = 88px.
 */
export const BROWSE_PIN_ZOOM_SIZE: [number, number][] = [
  [12, 0.5],
  [16, 2],
  [24, 15],
];

export function browsePinIconSizeAtZoom(zoom: number): number {
  const pairs = BROWSE_PIN_ZOOM_SIZE;
  if (zoom <= pairs[0][0]) return pairs[0][1];
  for (let i = 0; i < pairs.length - 1; i++) {
    const [z0, s0] = pairs[i];
    const [z1, s1] = pairs[i + 1];
    if (zoom <= z1) return s0 + ((s1 - s0) * (zoom - z0)) / (z1 - z0);
  }
  return pairs[pairs.length - 1][1];
}

export function createDefaultPinImageData(
  rasterSize: number = PIN_ICON_SIZE,
  border?: PinBorderOptions
): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const size = rasterSize;
  const strokeStyle = border?.strokeStyle ?? '#fff';
  const lineWidth = border?.lineWidth ?? PIN_BORDER_WIDTH;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { width: size, height: size, data: new Uint8ClampedArray(size * size * 4) };
  }
  const r = size / 2 - lineWidth;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  ctx.fillStyle = '#2563eb';
  ctx.fill();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  const imageData = ctx.getImageData(0, 0, size, size);
  return { width: size, height: size, data: imageData.data };
}

/** Resize a loaded image to the given raster size and return ImageData for map.addImage. Border optional (default white). Use MAP_PIN_RASTER_SIZE for browse map pins. */
export function imageToPinImageData(
  img: HTMLImageElement,
  rasterSize: number = PIN_ICON_SIZE,
  border?: PinBorderOptions
): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const size = rasterSize;
  const strokeStyle = border?.strokeStyle ?? '#fff';
  const lineWidth = border?.lineWidth ?? PIN_BORDER_WIDTH;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { width: size, height: size, data: new Uint8ClampedArray(size * size * 4) };
  }
  const r = size / 2 - lineWidth;
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, 0, 0, size, size);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  const imageData = ctx.getImageData(0, 0, size, size);
  return { width: size, height: size, data: imageData.data };
}
