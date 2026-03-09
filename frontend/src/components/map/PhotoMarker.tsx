/** Callout pin element for a photo location on the map. Used with maplibre Marker. */
const CALLOUT_SIZE = 60;
const CALLOUT_POINTER_SIZE = 8;

const calloutBubbleStyle = [
  `width: ${CALLOUT_SIZE}px; height: ${CALLOUT_SIZE}px;`,
  'background: #fff;',
  'border-radius: 50%;',
  'border: 2px solid #fff;',
  'box-shadow: 0 2px 6px rgba(0,0,0,0.3);',
  'overflow: hidden;',
].join(' ');

const calloutPointerStyle = [
  'display: block;',
  'width: 0; height: 0;',
  `border-left: ${CALLOUT_POINTER_SIZE}px solid transparent;`,
  `border-right: ${CALLOUT_POINTER_SIZE}px solid transparent;`,
  `border-top: ${CALLOUT_POINTER_SIZE}px solid #fff;`,
  'margin: 0 auto;',
  'filter: drop-shadow(0 2px 2px rgba(0,0,0,0.15));',
].join(' ');

const calloutImgStyle = [
  `width: ${CALLOUT_SIZE}px; height: ${CALLOUT_SIZE}px;`,
  'display: block;',
  'object-fit: cover;',
  'opacity: 0;',
].join(' ');

function createCalloutImg(src: string): HTMLImageElement {
  const img = document.createElement('img');
  img.alt = '';
  img.style.cssText = calloutImgStyle;
  img.src = src;
  img.addEventListener('load', () => {
    img.style.opacity = '1';
  });
  img.addEventListener('error', () => {
    img.remove();
  });
  return img;
}

/**
 * Creates a callout-bubble DOM element for a photo map pin.
 * The bottom tip of the pointer aligns with the GPS coordinate (use MapLibre anchor: 'bottom').
 * If thumbnailUrl is provided, renders the image at its natural aspect ratio.
 * Otherwise renders an empty white box placeholder.
 */
export function createPhotoCalloutElement(onClick?: () => void, thumbnailUrl?: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'photo-callout';
  el.style.cssText = 'cursor: pointer; display: flex; flex-direction: column; align-items: center;';

  if (onClick) {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
  }

  const bubble = document.createElement('div');
  bubble.className = 'photo-callout-bubble';
  bubble.style.cssText = calloutBubbleStyle;

  if (thumbnailUrl) {
    bubble.appendChild(createCalloutImg(thumbnailUrl));
  }

  const pointer = document.createElement('div');
  pointer.className = 'photo-callout-pointer';
  pointer.style.cssText = calloutPointerStyle;

  el.appendChild(bubble);
  el.appendChild(pointer);
  return el;
}

/**
 * Sets the thumbnail image on an existing callout element.
 * No-op if thumbnailUrl is empty or an image already exists.
 */
export function setCalloutThumbnail(el: HTMLElement, thumbnailUrl: string): void {
  if (!thumbnailUrl) return;
  const bubble = el.querySelector('.photo-callout-bubble');
  if (!bubble || bubble.querySelector('img')) return;

  bubble.appendChild(createCalloutImg(thumbnailUrl));
}
