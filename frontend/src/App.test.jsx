import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminPage, Composer, LoadError, PostCard } from './App.jsx';

function fileOf(name, type, size = 1024) {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('LoadError', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows a retry action for recoverable load failures', () => {
    const onRetry = vi.fn();
    render(<LoadError title="Could not load feed" message="HTTP 500" onRetry={onRetry} />);

    expect(screen.getByText('Could not load feed')).toBeInTheDocument();
    expect(screen.getByText('HTTP 500')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('Composer', () => {
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let originalXMLHttpRequest;
  let originalFetch;

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    originalXMLHttpRequest = global.XMLHttpRequest;
    originalFetch = global.fetch;
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    global.XMLHttpRequest = originalXMLHttpRequest;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('shows a red error for oversized video attachments', () => {
    const { container } = render(<Composer token="token" onPost={vi.fn()} />);
    const videoInput = container.querySelector('input[accept="video/mp4,video/webm,video/quicktime"]');

    fireEvent.change(videoInput, {
      target: { files: [fileOf('large.mp4', 'video/mp4', 50 * 1024 * 1024 + 1)] },
    });

    expect(screen.getByText('Video must be 50MB or smaller.')).toBeInTheDocument();
  });

  it('shows a video preview for valid video attachments', () => {
    const { container } = render(<Composer token="token" onPost={vi.fn()} />);
    const videoInput = container.querySelector('input[accept="video/mp4,video/webm,video/quicktime"]');

    fireEvent.change(videoInput, {
      target: { files: [fileOf('clip.webm', 'video/webm')] },
    });

    const preview = container.querySelector('video[src="blob:preview"]');
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute('controls');
  });

  it('uploads media before posting and sends videoUrl in the post body', async () => {
    const onPost = vi.fn();
    const xhrInstances = [];
    class MockXHR {
      constructor() {
        this.upload = {};
        this.headers = {};
        xhrInstances.push(this);
      }
      open(method, url) {
        this.method = method;
        this.url = url;
      }
      setRequestHeader(name, value) {
        this.headers[name] = value;
      }
      send(body) {
        this.body = body;
        this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
        this.complete = () => {
          this.status = 200;
          this.responseText = JSON.stringify({ url: '/uploads/clip.mp4' });
          this.onload?.();
        };
      }
    }
    global.XMLHttpRequest = MockXHR;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1, text: 'hello', videoUrl: '/uploads/clip.mp4' }),
    });

    const { container } = render(<Composer token="token" onPost={onPost} />);
    fireEvent.change(screen.getByPlaceholderText("What's happening?"), {
      target: { value: 'hello' },
    });
    const videoInput = container.querySelector('input[accept="video/mp4,video/webm,video/quicktime"]');
    fireEvent.change(videoInput, {
      target: { files: [fileOf('clip.mp4', 'video/mp4')] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByText(/Uploading video/)).toBeInTheDocument();
    xhrInstances[0].complete();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/posts', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'hello', videoUrl: '/uploads/clip.mp4' }),
      }));
    });
    expect(xhrInstances[0].method).toBe('POST');
    expect(xhrInstances[0].url).toBe('/api/upload');
    expect(xhrInstances[0].headers.Authorization).toBe('Bearer token');
    expect(onPost).toHaveBeenCalledWith({ id: 1, text: 'hello', videoUrl: '/uploads/clip.mp4' });
  });

  it('allows image-only submissions', async () => {
    const onPost = vi.fn();
    class MockXHR {
      constructor() {
        this.upload = {};
        this.headers = {};
      }
      open(method, url) {
        this.method = method;
        this.url = url;
      }
      setRequestHeader(name, value) {
        this.headers[name] = value;
      }
      send() {
        this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 1 });
        setTimeout(() => {
          this.status = 200;
          this.responseText = JSON.stringify({ url: '/uploads/image.png' });
          this.onload?.();
        }, 0);
      }
    }
    global.XMLHttpRequest = MockXHR;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 2, text: '', imageUrl: '/uploads/image.png' }),
    });

    const { container } = render(<Composer token="token" onPost={onPost} />);
    const imageInput = container.querySelector('input[accept="image/jpeg,image/png,image/gif,image/webp"]');
    fireEvent.change(imageInput, {
      target: { files: [fileOf('image.png', 'image/png')] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/posts', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: '', imageUrl: '/uploads/image.png' }),
      }));
    });
    expect(onPost).toHaveBeenCalledWith({ id: 2, text: '', imageUrl: '/uploads/image.png' });
  });

  it('allows video-only submissions', async () => {
    const onPost = vi.fn();
    class MockXHR {
      constructor() {
        this.upload = {};
      }
      open() {}
      setRequestHeader() {}
      send() {
        this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 1 });
        setTimeout(() => {
          this.status = 200;
          this.responseText = JSON.stringify({ url: '/uploads/video.mp4' });
          this.onload?.();
        }, 0);
      }
    }
    global.XMLHttpRequest = MockXHR;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 3, text: '', videoUrl: '/uploads/video.mp4' }),
    });

    const { container } = render(<Composer token="token" onPost={onPost} />);
    const videoInput = container.querySelector('input[accept="video/mp4,video/webm,video/quicktime"]');
    fireEvent.change(videoInput, {
      target: { files: [fileOf('video.mp4', 'video/mp4')] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/posts', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: '', videoUrl: '/uploads/video.mp4' }),
      }));
    });
    expect(onPost).toHaveBeenCalledWith({ id: 3, text: '', videoUrl: '/uploads/video.mp4' });
  });
});

describe('PostCard', () => {
  it('hydrates interaction buttons from post viewer state', () => {
    const { container } = render(
      <PostCard
        post={{
          id: 9,
          text: 'stateful post',
          timestamp: new Date().toISOString(),
          author: { username: 'gary' },
          isLiked: true,
          isReposted: true,
          isBookmarked: true,
          likeCount: 2,
          repostCount: 1,
        }}
        token="token"
        onNavigate={vi.fn()}
        currentUser={{ username: 'gary' }}
      />,
    );

    const [likeButton, repostButton, bookmarkButton] = container.querySelectorAll('article button');
    expect(likeButton).toHaveStyle({ color: '#ec4899' });
    expect(repostButton).toHaveStyle({ color: '#4ade80' });
    expect(bookmarkButton).toHaveStyle({ color: '#eab308' });
  });

  it('renders image before video and navigates when a hashtag is clicked', () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <PostCard
        post={{
          id: 1,
          text: 'hello #topic',
          imageUrl: '/uploads/image.png',
          videoUrl: '/uploads/video.mp4',
          timestamp: new Date().toISOString(),
          author: { username: 'gary' },
        }}
        token="token"
        onNavigate={onNavigate}
        currentUser={{ username: 'gary' }}
      />,
    );

    const image = container.querySelector('img[src="/uploads/image.png"]');
    const video = container.querySelector('video[src="/uploads/video.mp4"]');
    expect(image.compareDocumentPosition(video) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByText('#topic'));
    expect(onNavigate).toHaveBeenCalledWith('hashtag', 'topic');
  });
});

describe('AdminPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('fetches reports and approves a report with JWT auth', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          {
            id: 5,
            contentType: 'post',
            reason: 'spam',
            status: 'pending',
            authorUsername: 'gary',
            createdAt: '2026-05-18T00:00:00.000Z',
          },
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 5, status: 'approved' }),
      });

    render(<AdminPage token="admin-token" user={{ role: 'admin' }} />);

    expect(await screen.findByText('spam')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/reports/5', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
      }));
    });
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer admin-token');
  });

  it('fetches moderation logs and stats tabs', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          {
            id: 2,
            contentType: 'image',
            decision: 'rejected',
            reason: 'unsafe',
            detectionMethod: 'google_vision',
            confidence: 0.91,
            createdAt: '2026-05-18T00:00:00.000Z',
          },
        ]),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total: 3, pending: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total: 7, rejected: 2 }) });

    render(<AdminPage token="admin-token" user={{ role: 'admin' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Moderation Logs' }));
    expect(await screen.findByText('google_vision')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Stats' }));
    expect(await screen.findByText('Total reports')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Moderation logs')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('does not render admin controls for non-admin users', () => {
    render(<AdminPage token="token" user={{ role: 'user' }} />);

    expect(screen.getByText('Admin access required')).toBeInTheDocument();
  });
});
