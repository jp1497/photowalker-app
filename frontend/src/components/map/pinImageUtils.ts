/** Shared pin image helpers for map symbol layers (route detail photos, browse routes). */

export const PIN_ICON_SIZE = 44;
/** Raster size for high-quality map pins. Larger than PIN_ICON_SIZE so the map scales a bigger bitmap when zooming. */
export const MAP_PIN_RASTER_SIZE = 256;
export const PIN_BORDER_WIDTH = 2;

export function createDefaultPinImageData(rasterSize: number = PIN_ICON_SIZE): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const size = rasterSize;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { width: size, height: size, data: new Uint8ClampedArray(size * size * 4) };
  }
  const r = size / 2 - PIN_BORDER_WIDTH;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  ctx.fillStyle = '#2563eb';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = PIN_BORDER_WIDTH;
  ctx.stroke();
  const imageData = ctx.getImageData(0, 0, size, size);
  return { width: size, height: size, data: imageData.data };
}

/** Resize a loaded image to the given raster size and return ImageData for map.addImage. White border to match default pin. Use MAP_PIN_RASTER_SIZE for browse map pins so zooming scales a higher-res bitmap. */
export function imageToPinImageData(img: HTMLImageElement, rasterSize: number = PIN_ICON_SIZE): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const size = rasterSize;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { width: size, height: size, data: new Uint8ClampedArray(size * size * 4) };
  }
  const r = size / 2 - PIN_BORDER_WIDTH;
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, 0, 0, size, size);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = PIN_BORDER_WIDTH;
  ctx.stroke();
  const imageData = ctx.getImageData(0, 0, size, size);
  return { width: size, height: size, data: imageData.data };
}
