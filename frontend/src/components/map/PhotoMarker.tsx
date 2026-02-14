/** Pin element for a photo location on the map. Used with maplibre Marker. */
const PIN_SIZE_PX = 24;
const THUMB_SIZE_PX = 44;

const blueDotStyle = [
  `width: ${PIN_SIZE_PX}px; height: ${PIN_SIZE_PX}px;`,
  'background: #2563eb; border: 2px solid #fff; border-radius: 50%;',
  'box-shadow: 0 1px 4px rgba(0,0,0,0.3);',
].join(' ');

function createBlueDot(): HTMLDivElement {
  const dot = document.createElement('div');
  dot.className = 'photo-marker-pin-dot';
  dot.setAttribute('aria-hidden', 'true');
  dot.style.cssText = blueDotStyle;
  return dot;
}

/**
 * Creates a DOM element for a map pin. If thumbnailUrl is provided, shows a
 * ~44px thumbnail with lazy load; placeholder blue dot until loaded; fallback
 * to blue dot on error. Otherwise shows a 24px blue dot.
 */
export function createPhotoMarkerElement(onClick?: () => void, thumbnailUrl?: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'photo-marker-pin';
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = [
    'position: relative; display: flex; align-items: center; justify-content: center;',
    'cursor: pointer;',
  ].join(' ');

  if (onClick) {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
  }

  if (!thumbnailUrl) {
    const dot = createBlueDot();
    el.style.width = `${PIN_SIZE_PX}px`;
    el.style.height = `${PIN_SIZE_PX}px`;
    el.appendChild(dot);
    return el;
  }

  el.style.width = `${THUMB_SIZE_PX}px`;
  el.style.height = `${THUMB_SIZE_PX}px`;

  const placeholder = createBlueDot();
  placeholder.style.position = 'absolute';
  el.appendChild(placeholder);

  const img = document.createElement('img');
  img.alt = '';
  img.className = 'photo-marker-thumb';
  img.style.cssText = [
    `width: ${THUMB_SIZE_PX}px; height: ${THUMB_SIZE_PX}px;`,
    'object-fit: cover; border: 2px solid #fff; border-radius: 50%;',
    'box-shadow: 0 1px 4px rgba(0,0,0,0.3);',
    'position: absolute; opacity: 0;',
  ].join(' ');
  img.src = thumbnailUrl;
  img.addEventListener('load', () => {
    placeholder.style.opacity = '0';
    img.style.opacity = '1';
  });
  img.addEventListener('error', () => {
    img.remove();
    placeholder.style.opacity = '1';
  });
  el.appendChild(img);

  return el;
}

/**
 * Upgrades an existing blue-dot marker element to show a thumbnail.
 * No-op if element already has a thumbnail or thumbnailUrl is empty.
 */
export function setMarkerThumbnail(el: HTMLElement, thumbnailUrl: string): void {
  if (!thumbnailUrl || el.querySelector('.photo-marker-thumb')) return;
  const dot = el.querySelector('.photo-marker-pin-dot');
  if (!dot) return;

  el.style.width = `${THUMB_SIZE_PX}px`;
  el.style.height = `${THUMB_SIZE_PX}px`;
  (dot as HTMLElement).style.position = 'absolute';

  const img = document.createElement('img');
  img.alt = '';
  img.className = 'photo-marker-thumb';
  img.style.cssText = [
    `width: ${THUMB_SIZE_PX}px; height: ${THUMB_SIZE_PX}px;`,
    'object-fit: cover; border: 2px solid #fff; border-radius: 50%;',
    'box-shadow: 0 1px 4px rgba(0,0,0,0.3);',
    'position: absolute; opacity: 0;',
  ].join(' ');
  img.src = thumbnailUrl;
  img.addEventListener('load', () => {
    (dot as HTMLElement).style.opacity = '0';
    img.style.opacity = '1';
  });
  img.addEventListener('error', () => {
    img.remove();
    (dot as HTMLElement).style.opacity = '1';
  });
  el.appendChild(img);
}
