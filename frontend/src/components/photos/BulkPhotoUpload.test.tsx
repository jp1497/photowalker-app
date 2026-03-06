/** Unit tests for BulkPhotoUpload: multi-file upload, per-file status, done callback. */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkPhotoUpload } from './BulkPhotoUpload';
import * as photosApi from '../../api/photos';

vi.mock('../../api/photos');

describe('BulkPhotoUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders file input and upload button', () => {
    render(<BulkPhotoUpload onDone={() => {}} />);
    expect(screen.getByLabelText(/select photos/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /upload/i })).toBeTruthy();
  });

  it('upload button is disabled when no files selected', () => {
    render(<BulkPhotoUpload onDone={() => {}} />);
    expect((screen.getByRole('button', { name: /upload/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows file names after selection', async () => {
    render(<BulkPhotoUpload onDone={() => {}} />);
    const input = screen.getByLabelText(/select photos/i);
    const file = new File(['x'], 'sunset.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, [file]);
    expect(screen.getByText('sunset.jpg')).toBeTruthy();
  });

  it('uploads each file with empty route_ids and calls onDone when done is clicked', async () => {
    const mockUpload = vi.mocked(photosApi.uploadPhoto);
    mockUpload.mockResolvedValue({
      photo: {
        id: 'p1', caption: null, user_id: 'u1',
        location: { type: 'Point', coordinates: [-122, 37] },
        s3_key_original: 'k', s3_key_thumbnail: null,
        file_size_bytes: 1, captured_at: null, created_at: '', updated_at: '',
      },
    });
    const onDone = vi.fn();
    render(<BulkPhotoUpload onDone={onDone} />);

    const input = screen.getByLabelText(/select photos/i);
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, [file]);
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(file, [], null);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /done/i })).toBeTruthy();
    });

    await userEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(onDone).toHaveBeenCalled();
  });

  it('shows error status for failed uploads', async () => {
    vi.mocked(photosApi.uploadPhoto).mockRejectedValue(new Error('Server error'));
    render(<BulkPhotoUpload onDone={() => {}} />);

    const input = screen.getByLabelText(/select photos/i);
    const file = new File(['x'], 'bad.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, [file]);
    await userEvent.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeTruthy();
    });
  });

  it('shows GPS note', () => {
    render(<BulkPhotoUpload onDone={() => {}} />);
    expect(screen.getByText(/without gps/i)).toBeTruthy();
  });
});
