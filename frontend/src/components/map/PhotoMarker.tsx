/** Pin element for a photo location on the map. Used with maplibre Marker. */
export function createPhotoMarkerElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'photo-marker-pin';
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = [
    'width: 24px; height: 24px;',
    'background: #2563eb; border: 2px solid #fff; border-radius: 50%;',
    'box-shadow: 0 1px 4px rgba(0,0,0,0.3);',
    'cursor: pointer;',
  ].join(' ');
  return el;
}
