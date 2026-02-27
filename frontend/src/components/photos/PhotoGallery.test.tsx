/** Unit tests for PhotoGallery: renders photos from API, selection, lightbox. */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotoGallery } from './PhotoGallery';

vi.mock('./PhotoImage', () => ({
  PhotoImage: ({ photoId, alt }: { photoId: string; alt?: string }) => (
    <div data-testid="photo-image" data-photo-id={photoId}>{alt ?? 'image'}</div>
  ),
}));

describe('PhotoGallery', () => {
  const photos = [
    { id: 'p1', caption: 'First' },
    { id: 'p2', caption: null },
    { id: 'p3', caption: 'Third' },
  ];

  it('renders photos from API', () => {
    render(<PhotoGallery photos={photos} />);

    expect(screen.getAllByTestId('photo-image')).toHaveLength(3);
    expect(screen.getAllByText('First').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Third').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "No photos yet" when photos array is empty', () => {
    render(<PhotoGallery photos={[]} />);
    expect(screen.getByText(/no photos yet/i)).toBeTruthy();
  });

  it('opens lightbox when a photo is clicked and calls onSelectPhoto', async () => {
    const onSelectPhoto = vi.fn();
    render(<PhotoGallery photos={photos} onSelectPhoto={onSelectPhoto} />);

    const buttons = screen.getAllByRole('button', { name: /first|image|third/i });
    await userEvent.click(buttons[0]);

    expect(onSelectPhoto).toHaveBeenCalledWith('p1');
    expect(screen.getByRole('dialog', { name: /photo lightbox/i })).toBeTruthy();
    expect(screen.getByText('Close')).toBeTruthy();
  });

  it('opens lightbox for selected photo when selectedPhotoId is set', () => {
    render(<PhotoGallery photos={photos} selectedPhotoId="p2" />);
    const dialog = screen.getByRole('dialog', { name: /photo lightbox/i });
    const img = within(dialog).getByTestId('photo-image');
    expect(img.getAttribute('data-photo-id')).toBe('p2');
  });

  it('when showGrid is false, does not render thumbnail grid (lightbox-only mode)', () => {
    render(
      <PhotoGallery
        photos={[{ id: 'p1', caption: 'Only' }]}
        selectedPhotoId="p1"
        showGrid={false}
      />,
    );
    expect(screen.queryAllByTestId('photo-image').length).toBe(1);
    const dialog = screen.getByRole('dialog', { name: /photo lightbox/i });
    expect(within(dialog).getByTestId('photo-image')).toBeTruthy();
  });

  it('calls onClose when lightbox is closed', async () => {
    const onClose = vi.fn();
    render(<PhotoGallery photos={photos} selectedPhotoId="p1" onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: /photo lightbox/i })).toBeTruthy();
    await userEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows user name and Open route when lightboxContext is provided', async () => {
    const onOpenRoute = vi.fn();
    render(
      <PhotoGallery
        photos={[{ id: 'p1', caption: 'Cap' }]}
        selectedPhotoId="p1"
        lightboxContext={{
          user: { id: 'u1', name: 'Alice' },
          routes: [{ slug: 'my-route', title: 'My Route' }],
          onOpenRoute,
        }}
      />,
    );
    expect(screen.getByRole('dialog', { name: /photo lightbox/i })).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    const openRouteBtn = screen.getByRole('button', { name: /open route/i });
    expect(openRouteBtn).toBeTruthy();
    await userEvent.click(openRouteBtn);
    expect(onOpenRoute).toHaveBeenCalledWith('my-route');
  });
});
