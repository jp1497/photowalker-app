/** Unit tests for PhotoMarker callout pin. */
import { describe, expect, it, vi } from 'vitest';
import { createPhotoCalloutElement, setCalloutThumbnail } from './PhotoMarker';

describe('createPhotoCalloutElement', () => {
  it('renders bubble and pointer elements', () => {
    const el = createPhotoCalloutElement();
    expect(el.classList.contains('photo-callout')).toBe(true);
    expect(el.querySelector('.photo-callout-bubble')).toBeTruthy();
    expect(el.querySelector('.photo-callout-pointer')).toBeTruthy();
  });

  it('without thumbnailUrl renders no img', () => {
    const el = createPhotoCalloutElement();
    expect(el.querySelector('img')).toBeFalsy();
  });

  it('with thumbnailUrl renders img inside bubble', () => {
    const el = createPhotoCalloutElement(undefined, 'https://example.com/thumb.jpg');
    const img = el.querySelector('.photo-callout-bubble img') as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img!.src).toContain('example.com/thumb.jpg');
  });

  it('with thumbnailUrl img starts hidden', () => {
    const el = createPhotoCalloutElement(undefined, 'https://example.com/thumb.jpg');
    const img = el.querySelector('.photo-callout-bubble img') as HTMLImageElement | null;
    expect(img!.style.opacity).toBe('0');
  });

  it('with onClick attaches click handler', () => {
    const onClick = vi.fn();
    const el = createPhotoCalloutElement(onClick);
    el.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('setCalloutThumbnail', () => {
  it('adds img to bubble when none exists', () => {
    const el = createPhotoCalloutElement();
    expect(el.querySelector('img')).toBeFalsy();
    setCalloutThumbnail(el, 'https://example.com/photo.jpg');
    const img = el.querySelector('.photo-callout-bubble img') as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img!.src).toContain('example.com/photo.jpg');
  });

  it('added img starts hidden', () => {
    const el = createPhotoCalloutElement();
    setCalloutThumbnail(el, 'https://example.com/photo.jpg');
    const img = el.querySelector('.photo-callout-bubble img') as HTMLImageElement | null;
    expect(img!.style.opacity).toBe('0');
  });

  it('is no-op when thumbnailUrl is empty', () => {
    const el = createPhotoCalloutElement();
    setCalloutThumbnail(el, '');
    expect(el.querySelector('img')).toBeFalsy();
  });

  it('is no-op when img already exists', () => {
    const el = createPhotoCalloutElement(undefined, 'https://a.com/1.jpg');
    setCalloutThumbnail(el, 'https://b.com/2.jpg');
    const imgs = el.querySelectorAll('img');
    expect(imgs.length).toBe(1);
    expect((imgs[0] as HTMLImageElement).src).toContain('a.com/1.jpg');
  });
});
