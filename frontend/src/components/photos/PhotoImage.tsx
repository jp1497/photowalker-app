/** Renders a photo image by ID. Fetches with auth, uses thumbnail when available, fallback to original. */
import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';

interface PhotoImageProps {
  photoId: string;
  size?: 'thumbnail' | 'original';
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}

const baseURL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? 'http://localhost:8000');

function buildImageUrl(photoId: string, size: 'thumbnail' | 'original'): string {
  return `${baseURL}/v1/photos/${encodeURIComponent(photoId)}/image?size=${size}`;
}

export function PhotoImage({ photoId, size = 'thumbnail', alt = '', className, style }: PhotoImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    const controller = new AbortController();
    const tryThumbnail = size === 'thumbnail';
    const primaryUrl = buildImageUrl(photoId, tryThumbnail ? 'thumbnail' : 'original');
    const attach = (res: { data: Blob }) => {
      url = URL.createObjectURL(res.data);
      setObjectUrl(url);
      setError(false);
    };
    apiClient
      .get(primaryUrl, { responseType: 'blob', signal: controller.signal })
      .then(attach)
      .catch(() => {
        if (tryThumbnail) {
          return apiClient
            .get(buildImageUrl(photoId, 'original'), { responseType: 'blob', signal: controller.signal })
            .then(attach);
        }
        setError(true);
      })
      .catch(() => setError(true));

    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [photoId, size]);

  if (error) {
    return (
      <div className={className} style={{ ...style, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '0.75rem' }}>
        Image unavailable
      </div>
    );
  }

  if (!objectUrl) {
    return (
      <div className={className} style={{ ...style, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '0.75rem' }}>
        Loading…
      </div>
    );
  }

  return <img src={objectUrl} alt={alt} className={className} style={style} />;
}
