/** Shared pin image helpers for map symbol layers (route detail photos, browse routes). */

export const PIN_ICON_SIZE = 44;
export const PIN_BORDER_WIDTH = 2;

export function createDefaultPinImageData(): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const size = PIN_ICON_SIZE;
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

/** Resize a loaded image to PIN_ICON_SIZE and return ImageData for map.addImage. White border to match default pin. */
export function imageToPinImageData(img: HTMLImageElement): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
} {
  const size = PIN_ICON_SIZE;
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
