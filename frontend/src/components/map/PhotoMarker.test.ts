/** Unit tests for PhotoMarker: thumbnail vs blue-dot rendering. */
import { describe, expect, it, vi } from 'vitest';
import { createPhotoMarkerElement, setMarkerThumbnail } from './PhotoMarker';

describe('createPhotoMarkerElement', () => {
  it('without thumbnailUrl renders blue dot', () => {
    const el = createPhotoMarkerElement();
    expect(el.classList.contains('photo-marker-pin')).toBe(true);
    const dot = el.querySelector('.photo-marker-pin-dot');
    expect(dot).toBeTruthy();
    expect(el.querySelector('img')).toBeFalsy();
  });

  it('with thumbnailUrl renders img and placeholder dot', () => {
    const el = createPhotoMarkerElement(undefined, 'https://example.com/thumb.jpg');
    expect(el.classList.contains('photo-marker-pin')).toBe(true);
    expect(el.querySelector('.photo-marker-pin-dot')).toBeTruthy();
    const img = el.querySelector('img');
    expect(img).toBeTruthy();
    expect((img as HTMLImageElement).src).toContain('example.com/thumb.jpg');
  });

  it('with onClick attaches click handler', () => {
    const onClick = vi.fn();
    const el = createPhotoMarkerElement(onClick);
    el.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('setMarkerThumbnail', () => {
  it('upgrades blue-dot element to show thumbnail', () => {
    const el = createPhotoMarkerElement();
    expect(el.querySelector('.photo-marker-thumb')).toBeFalsy();
    setMarkerThumbnail(el, 'https://example.com/photo.jpg');
    const img = el.querySelector('.photo-marker-thumb');
    expect(img).toBeTruthy();
    expect((img as HTMLImageElement).src).toContain('example.com/photo.jpg');
  });

  it('is no-op when thumbnailUrl is empty', () => {
    const el = createPhotoMarkerElement();
    setMarkerThumbnail(el, '');
    expect(el.querySelector('.photo-marker-thumb')).toBeFalsy();
  });

  it('is no-op when element already has thumbnail', () => {
    const el = createPhotoMarkerElement(undefined, 'https://a.com/1.jpg');
    const countBefore = el.querySelectorAll('.photo-marker-thumb').length;
    setMarkerThumbnail(el, 'https://b.com/2.jpg');
    expect(el.querySelectorAll('.photo-marker-thumb').length).toBe(countBefore);
  });
});
