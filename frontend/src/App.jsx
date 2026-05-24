import AdminDashboard from "./components/AdminDashboard.jsx";
import React, { useState, useEffect, useCallback, useRef } from "react";

const API = "https://labeouf-production.up.railway.app";
const LABEL_CONFIG = {
  POSITIVE: { color: "#4ade80", bg: "rgba(74,222,128,0.1)", icon: "↑" },
  NEGATIVE: { color: "#f87171", bg: "rgba(248,113,113,0.1)", icon: "↓" },
  NEUTRAL: { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", icon: "–" },
  ANOMALOUS_DATA: { color: "#fb923c", bg: "rgba(251,146,60,0.1)", icon: "⚠" },
  CRITICAL_ANOMALY: { color: "#ff0040", bg: "rgba(255,0,64,0.15)", icon: "☢" },
  ERROR: { color: "#64748b", bg: "rgba(100,116,139,0.1)", icon: "?" },
};

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const apiFetch = async (path, token, opts = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
};

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

async function registerPushNotifications(token) {
  if (!token || typeof window === "undefined") return;
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const keyResponse = await apiFetch("/push/vapid-public-key", token);
  if (!keyResponse.publicKey) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const registration = await navigator.serviceWorker.register("/push-sw.js");
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(keyResponse.publicKey),
  });

  await apiFetch("/push/subscribe", token, {
    method: "POST",
    body: JSON.stringify(subscription),
  });
}

function Avatar({ name, size = 40, url, onClick }) {
  const colors = ["#6366f1","#8b5cf6","#ec4899","#14b8a6","#f59e0b","#3b82f6"];
  const color = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  const style = { width: size, height: size, borderRadius: "50%", flexShrink: 0, cursor: onClick ? "pointer" : "default" };
  if (url) return <img src={url} style={{ ...style, objectFit: "cover" }} onClick={onClick} alt={name} />;
  return (
    <div style={{ ...style, background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 700, color: "#fff", fontFamily: "'DM Mono', monospace" }} onClick={onClick}>
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function AuditBadge({ meta }) {
  if (!meta?.label) return null;
  const cfg = LABEL_CONFIG[meta.label] ?? LABEL_CONFIG.NEUTRAL;
  return (
    <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}40`, borderRadius: 4, padding: "1px 6px", letterSpacing: "0.05em", display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
      {cfg.icon} {meta.label}{meta.entropy != null && <span style={{ opacity: 0.7 }}>·{meta.entropy.toFixed(1)}H</span>}
    </span>
  );
}

export function LoadError({ title = "Something went wrong", message, onRetry }) {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "#4a5568" }}>
      <p style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 700, color: "#f87171", marginBottom: 8 }}>{title}</p>
      <p style={{ fontSize: 14, margin: "0 auto 16px", maxWidth: 360, lineHeight: 1.5 }}>{message || "The request failed. Try again in a moment."}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{ background: "#1d9bf0", color: "#fff", border: "none", borderRadius: 9999, padding: "9px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Sora', sans-serif" }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

const HASHTAG_SPLIT_RE = /(#[A-Za-z0-9_]+)/g;

export function PostTextWithHashtags({ text, onNavigate }) {
  if (text == null || text === "") return null;
  const parts = String(text).split(HASHTAG_SPLIT_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (part.length > 1 && part[0] === "#" && /^#[A-Za-z0-9_]+$/.test(part)) {
          const tag = part.slice(1);
          return (
            <span
              key={`h-${i}-${part}`}
              role="link"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onNavigate("hashtag", tag);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onNavigate("hashtag", tag);
                }
              }}
              style={{ cursor: "pointer", color: "#1d9bf0", fontWeight: 600 }}
            >
              {part}
            </span>
          );
        }
        return <span key={`t-${i}`}>{part}</span>;
      })}
    </>
  );
}

function HashtagPage({ tag, token, onNavigate, currentUser }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!tag) {
      setPosts([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError(null);
    setLoading(true);
    apiFetch(`/posts/hashtag/${encodeURIComponent(tag)}`, token)
      .then((data) => {
        if (!cancelled) setPosts(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!cancelled) {
          setPosts([]);
          setError(e.message || "Could not load this hashtag.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tag, token, retryKey]);

  if (!tag) {
    return <div style={{ padding: 40, textAlign: "center", color: "#4a5568" }}>Invalid hashtag.</div>;
  }
  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#4a5568", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>Loading...</div>;
  }
  if (error) {
    return <LoadError title={`Could not load #${tag}`} message={error} onRetry={() => setRetryKey(k => k + 1)} />;
  }
  if (!posts.length) {
    return <div style={{ padding: 40, textAlign: "center", color: "#4a5568" }}>No posts for #{tag}.</div>;
  }

  return (
    <div>
      {posts.map((post, i) => (
        <PostCard key={`${post.id}-${i}`} post={post} token={token} onNavigate={onNavigate} currentUser={currentUser} />
      ))}
    </div>
  );
}

export function PostCard({ post, token, onNavigate, currentUser, onBookmarkChange }) {
  const [liked, setLiked] = useState(!!post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0);
  const [reposted, setReposted] = useState(!!post.isReposted);
  const [repostCount, setRepostCount] = useState(post.repostCount ?? 0);
  const [bookmarked, setBookmarked] = useState(!!post.isBookmarked);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [postingReply, setPostingReply] = useState(false);
  const isPanic = post.auditMetadata?.label === "CRITICAL_ANOMALY";

  useEffect(() => {
    setLiked(!!post.isLiked);
    setReposted(!!post.isReposted);
    setBookmarked(!!post.isBookmarked);
    setLikeCount(post.likeCount ?? 0);
    setRepostCount(post.repostCount ?? 0);
  }, [post.id, post.isLiked, post.isReposted, post.isBookmarked, post.likeCount, post.repostCount]);

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!token) return;
    try {
      const data = await apiFetch(`/posts/${post.id}/like`, token, { method: "POST" });
      setLikeCount(data.likeCount);
      setLiked(data.liked);
    } catch {}
  };

  const handleRepost = async (e) => {
    e.stopPropagation();
    if (!token) return;
    try {
      const data = await apiFetch(`/posts/${post.id}/repost`, token, { method: "POST" });
      setRepostCount(data.repostCount); setReposted(data.reposted);
    } catch {}
  };

  const handleBookmark = async (e) => {
    e.stopPropagation();
    if (!token) return;
    try {
      const data = await apiFetch(`/bookmarks/${post.id}`, token, { method: "POST" });
      setBookmarked(data.bookmarked);
      onBookmarkChange?.(post.id, data.bookmarked);
    } catch {}
  };

  const toggleReplies = async (e) => {
    e.stopPropagation();
    if (!showReplies) {
      setLoadingReplies(true);
      try {
        const data = await apiFetch(`/posts/${post.id}/replies`, token);
        setReplies(data);
      } catch {}
      setLoadingReplies(false);
    }
    setShowReplies(p => !p);
  };

  const handleReply = async () => {
    if (!replyText.trim() || !token || postingReply) return;
    setPostingReply(true);
    try {
      const reply = await apiFetch(`/posts/${post.id}/replies`, token, { method: "POST", body: JSON.stringify({ text: replyText.trim() }) });
      setReplies(p => [...p, reply]);
      setReplyText("");
    } catch {}
    setPostingReply(false);
  };

  const btnStyle = (active, activeColor) => ({
    background: "none", border: "none", cursor: token ? "pointer" : "default",
    display: "flex", alignItems: "center", gap: 5,
    color: active ? activeColor : "#4a5568", fontSize: 13, padding: "4px 8px",
    borderRadius: 9999, transition: "all 0.15s", fontFamily: "'DM Mono', monospace",
  });

  return (
    <article style={{ borderBottom: "1px solid #1e2733", position: "relative" }}>
      {post.isRepost && (
        <div style={{ padding: "8px 20px 0 56px", color: "#4a5568", fontSize: 12, fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", gap: 6 }}>
          <span>⟳</span> <span style={{ cursor: "pointer" }} onClick={() => onNavigate("profile", post.repostedBy?.username)}>{post.repostedBy?.displayName || post.repostedBy?.username}</span> reposted
        </div>
      )}
      {isPanic && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "linear-gradient(180deg,#ff0040,#ff004080)" }} />}
      <div style={{ padding: "12px 20px 0", display: "flex", gap: 12, background: isPanic ? "rgba(255,0,64,0.03)" : "transparent" }}>
        <Avatar name={post.author?.username} url={post.author?.avatarUrl} onClick={() => onNavigate("profile", post.author?.username)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, color: "#e7edf3", fontSize: 15, cursor: "pointer" }} onClick={() => onNavigate("profile", post.author?.username)}>
              {post.author?.displayName || post.author?.username}
            </span>
            <span style={{ color: "#4a5568", fontSize: 13 }}>@{post.author?.username}</span>
            <span style={{ color: "#2d3748" }}>·</span>
            <span style={{ color: "#4a5568", fontSize: 12 }}>{timeAgo(post.timestamp)}</span>
            <AuditBadge meta={post.auditMetadata} />
          </div>
          <p style={{ margin: "0 0 10px", color: "#c9d6e3", fontSize: 15, lineHeight: 1.55, wordBreak: "break-word" }}>
            <PostTextWithHashtags text={post.text} onNavigate={onNavigate} />
          </p>
          {post.imageUrl && (
            <div style={{ margin: "0 0 10px", borderRadius: 12, overflow: "hidden", border: "1px solid #1e2733", maxWidth: "min(100%, 520px)" }}>
              <img src={post.imageUrl} alt="" style={{ width: "100%", display: "block", maxHeight: 360, objectFit: "cover" }} />
            </div>
          )}
          {post.videoUrl && (
            <div style={{ margin: "0 0 10px", borderRadius: 12, overflow: "hidden", border: "1px solid #1e2733", maxWidth: "min(100%, 500px)" }}>
              <video src={post.videoUrl} controls playsInline style={{ width: "100%", display: "block", maxWidth: 500 }} />
            </div>
          )}
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            <button style={btnStyle(liked, "#ec4899")} onClick={handleLike}
              onMouseEnter={e => { if (token) { e.currentTarget.style.background = "rgba(236,72,153,0.1)"; e.currentTarget.style.color = "#ec4899"; }}}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; if (!liked) e.currentTarget.style.color = "#4a5568"; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              {likeCount > 0 && likeCount}
            </button>
            <button style={btnStyle(reposted, "#4ade80")} onClick={handleRepost}
              onMouseEnter={e => { if (token) { e.currentTarget.style.background = "rgba(74,222,128,0.1)"; e.currentTarget.style.color = "#4ade80"; }}}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; if (!reposted) e.currentTarget.style.color = "#4a5568"; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
              {repostCount > 0 && repostCount}
            </button>
            <button style={btnStyle(bookmarked, "#eab308")} onClick={handleBookmark}
              onMouseEnter={e => { if (token) { e.currentTarget.style.background = "rgba(234,179,8,0.12)"; e.currentTarget.style.color = "#eab308"; }}}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; if (!bookmarked) e.currentTarget.style.color = "#4a5568"; }}
              title="Bookmark"
            >
              <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden>🔖</span>
            </button>
            <button style={btnStyle(showReplies, "#1d9bf0")} onClick={toggleReplies}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(29,155,240,0.1)"; e.currentTarget.style.color = "#1d9bf0"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; if (!showReplies) e.currentTarget.style.color = "#4a5568"; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Reply
            </button>
          </div>
        </div>
      </div>

      {showReplies && (
        <div style={{ borderTop: "1px solid #1e2733", background: "rgba(255,255,255,0.01)" }}>
          {token && (
            <div style={{ padding: "12px 20px", display: "flex", gap: 10, borderBottom: "1px solid #1e2733" }}>
              <Avatar name={currentUser?.username} url={currentUser?.avatarUrl} size={32} />
              <div style={{ flex: 1, display: "flex", gap: 8 }}>
                <input value={replyText} onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleReply()}
                  placeholder="Write a reply..."
                  style={{ flex: 1, background: "#0d1117", border: "1px solid #1e2733", borderRadius: 9999, padding: "8px 14px", color: "#e7edf3", fontSize: 14, outline: "none", fontFamily: "'Sora', sans-serif" }}
                />
                <button onClick={handleReply} disabled={!replyText.trim() || postingReply} style={{ background: "#1d9bf0", color: "#fff", border: "none", borderRadius: 9999, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Sora', sans-serif", opacity: !replyText.trim() ? 0.5 : 1 }}>
                  {postingReply ? "..." : "Reply"}
                </button>
              </div>
            </div>
          )}
          {loadingReplies
            ? <div style={{ padding: 16, textAlign: "center", color: "#4a5568", fontSize: 13 }}>Loading...</div>
            : replies.length === 0
              ? <div style={{ padding: 16, textAlign: "center", color: "#4a5568", fontSize: 13 }}>No replies yet.</div>
              : replies.map(reply => (
                <div key={reply.id} style={{ padding: "12px 20px", borderBottom: "1px solid #1e2733", display: "flex", gap: 10 }}>
                  <Avatar name={reply.author?.username} url={reply.author?.avatarUrl} size={32} onClick={() => onNavigate("profile", reply.author?.username)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: "#e7edf3", fontSize: 14, cursor: "pointer" }} onClick={() => onNavigate("profile", reply.author?.username)}>
                        {reply.author?.displayName || reply.author?.username}
                      </span>
                      <span style={{ color: "#4a5568", fontSize: 12 }}>@{reply.author?.username}</span>
                      <span style={{ color: "#2d3748" }}>·</span>
                      <span style={{ color: "#4a5568", fontSize: 12 }}>{timeAgo(reply.timestamp)}</span>
                      <AuditBadge meta={reply.auditMetadata} />
                    </div>
                    <p style={{ margin: 0, color: "#c9d6e3", fontSize: 14, lineHeight: 1.5 }}>{reply.text}</p>
                  </div>
                </div>
              ))
          }
        </div>
      )}
    </article>
  );
}

export function Composer({ token, onPost }) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);
  const [pendingImage, setPendingImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [pendingVideo, setPendingVideo] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileLabel, setUploadingFileLabel] = useState(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const recordVideoInputRef = useRef(null);
  const max = 280;
  const remaining = max - text.length;
  const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
  const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
  const hasAttachment = !!pendingImage || !!pendingVideo;
  const canPost = (text.trim().length > 0 || hasAttachment) && remaining >= 0 && !posting;
  const isUploading = !!uploadingFileLabel;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [previewUrl, videoPreviewUrl]);

  const clearImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearVideo = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(null);
    setPendingVideo(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (recordVideoInputRef.current) recordVideoInputRef.current.value = "";
  };

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > IMAGE_MAX_BYTES) {
      setError(`Image must be ${IMAGE_MAX_BYTES / 1024 / 1024}MB or smaller.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setError(null);
    setPendingImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const onPickVideo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > VIDEO_MAX_BYTES) {
      setError(`Video must be ${VIDEO_MAX_BYTES / 1024 / 1024}MB or smaller.`);
      e.target.value = "";
      return;
    }
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setError(null);
    setPendingVideo(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
  };

  const uploadFile = (file, label) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error("Invalid upload response")); }
        return;
      }
      try {
        const err = JSON.parse(xhr.responseText);
        reject(new Error(err.message || `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed due to network error"));
    const fd = new FormData();
    fd.append("file", file);
    setUploadingFileLabel(label);
    setUploadProgress(0);
    xhr.send(fd);
  });

  const handlePost = async () => {
    if (!canPost) return;
    setPosting(true); setError(null);
    try {
      let imageUrl;
      if (pendingImage) {
        const { url } = await uploadFile(pendingImage, "image");
        imageUrl = url;
      }
      let videoUrl;
      if (pendingVideo) {
        const { url } = await uploadFile(pendingVideo, "video");
        videoUrl = url;
      }
      const body = { text: text.trim() };
      if (imageUrl) body.imageUrl = imageUrl;
      if (videoUrl) body.videoUrl = videoUrl;
      const post = await apiFetch("/posts", token, { method: "POST", body: JSON.stringify(body) });
      setText("");
      clearImage();
      clearVideo();
      onPost(post);
    } catch (e) {
      setError(e.message || "Failed to post. Try again.");
    } finally {
      setPosting(false);
      setUploadingFileLabel(null);
      setUploadProgress(0);
    }
  };

  return (
    <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e2733" }}>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" capture="environment" style={{ display: "none" }} onChange={onPickImage} />
      <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" style={{ display: "none" }} onChange={onPickVideo} />
      <input ref={recordVideoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" capture="camcorder" style={{ display: "none" }} onChange={onPickVideo} />
      <div style={{ display: "flex", gap: 12 }}>
        <Avatar name="me" size={44} />
        <div style={{ flex: 1 }}>
          <textarea value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.metaKey || e.ctrlKey) && handlePost()}
            placeholder="What's happening?"
            style={{ width: "100%", background: "none", border: "none", outline: "none", color: "#e7edf3", fontSize: 18, lineHeight: 1.5, resize: "none", fontFamily: "'Sora', sans-serif", minHeight: 80, boxSizing: "border-box" }}
          />
          {(previewUrl || videoPreviewUrl) && <div style={{ color: "#64748b", fontSize: 12, marginBottom: 6, fontFamily: "'DM Mono', monospace" }}>{previewUrl && "Image attached"}{previewUrl && videoPreviewUrl ? " · " : ""}{videoPreviewUrl && "Video attached"}</div>}
          {previewUrl && (
            <div style={{ position: "relative", marginTop: 8, borderRadius: 12, overflow: "hidden", border: "1px solid #1e2733", maxWidth: "min(100%, 420px)" }}>
              <img src={previewUrl} alt="Attachment preview" style={{ width: "100%", display: "block", maxHeight: 220, objectFit: "cover" }} />
              <button type="button" onClick={clearImage} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.65)", color: "#fff", border: "none", borderRadius: 9999, width: 28, height: 28, cursor: "pointer", fontSize: 16, lineHeight: 1 }} aria-label="Remove image">✕</button>
            </div>
          )}
          {videoPreviewUrl && (
            <div style={{ position: "relative", marginTop: 8, borderRadius: 12, overflow: "hidden", border: "1px solid #1e2733", maxWidth: "min(100%, 420px)" }}>
              <video src={videoPreviewUrl} controls playsInline style={{ width: "100%", display: "block", maxHeight: 260 }} />
              <button type="button" onClick={clearVideo} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.65)", color: "#fff", border: "none", borderRadius: 9999, width: 28, height: 28, cursor: "pointer", fontSize: 16, lineHeight: 1 }} aria-label="Remove video">✕</button>
            </div>
          )}
          {uploadingFileLabel && (
            <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
              <span>{`Uploading ${uploadingFileLabel}…${uploadProgress > 0 ? ` ${uploadProgress}%` : ''}`}</span>
              <div style={{ flex: 1, height: 6, borderRadius: 9999, background: "#0f172a", overflow: "hidden" }}><div style={{ width: `${uploadProgress}%`, height: "100%", background: "#1d9bf0" }} /></div>
            </div>
          )}
          {error && <p style={{ color: "#f87171", fontSize: 13, margin: "4px 0" }}>{error}</p>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" disabled={posting} onClick={() => !posting && fileInputRef.current?.click()} title="Add image" style={{ background: "none", border: "none", cursor: posting ? "default" : "pointer", padding: 4, borderRadius: 9999, color: "#1d9bf0", display: "flex", alignItems: "center", justifyContent: "center", opacity: posting ? 0.5 : 1 }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(29,155,240,0.12)"; }} onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
              </button>
              <button type="button" disabled={posting} onClick={() => !posting && videoInputRef.current?.click()} title="Add video" style={{ background: "none", border: "none", cursor: posting ? "default" : "pointer", padding: 4, borderRadius: 9999, color: "#1d9bf0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, lineHeight: 1, opacity: posting ? 0.5 : 1 }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(29,155,240,0.12)"; }} onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>🎥</button>
              <button type="button" disabled={posting} onClick={() => !posting && recordVideoInputRef.current?.click()} title="Record video" style={{ background: "none", border: "none", cursor: posting ? "default" : "pointer", padding: 4, borderRadius: 9999, color: "#1d9bf0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, lineHeight: 1, opacity: posting ? 0.5 : 1 }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(29,155,240,0.12)"; }} onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>🎬</button>
              <div style={{ width: 28, height: 28, position: "relative" }}>
                <svg viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)", width: 28, height: 28 }}><circle cx="18" cy="18" r="15" fill="none" stroke="#1e2733" strokeWidth="3" /><circle cx="18" cy="18" r="15" fill="none" stroke={remaining < 20 ? (remaining < 0 ? "#ef4444" : "#f59e0b") : "#1d9bf0"} strokeWidth="3" strokeDasharray={`${Math.max(0, (1 - text.length / max) * 94.2)} 94.2`} /></svg>
                {remaining < 20 && <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: remaining < 0 ? "#ef4444" : "#f59e0b", fontFamily: "'DM Mono', monospace" }}>{remaining}</span>}
              </div>
            </div>
            <button onClick={handlePost} disabled={!canPost} style={{ background: canPost ? "#1d9bf0" : "#0f4f7a", color: canPost ? "#fff" : "#4a7a99", border: "none", borderRadius: 9999, padding: "8px 20px", fontSize: 15, fontWeight: 700, cursor: canPost ? "pointer" : "default", fontFamily: "'Sora', sans-serif" }}>{isUploading ? "Uploading…" : posting ? "Posting..." : "Post"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feed({ token, newPost, onNavigate, currentUser }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchFeed = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch(token ? "/posts/feed" : "/posts/public", token);
        if (!cancelled) setPosts(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) {
          setPosts([]);
          setError(e.message || "Could not load the feed.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchFeed();
    return () => {
      cancelled = true;
    };
  }, [token, retryKey]);

  useEffect(() => { if (newPost) setPosts(p => [newPost, ...p]); }, [newPost]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#4a5568", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>Loading feed...</div>;
  if (error) return <LoadError title="Could not load feed" message={error} onRetry={() => setRetryKey(k => k + 1)} />;
  if (!posts.length) return (
    <div style={{ padding: 40, textAlign: "center", color: "#4a5568" }}>
      <p style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 700, color: "#e7edf3" }}>Nothing here yet</p>
      <p style={{ fontSize: 14, marginTop: 8 }}>{token ? "Follow some users or post something." : "Sign in to see your feed."}</p>
    </div>
  );

  return <div>{posts.map((post, i) => <PostCard key={`${post.id}-${i}`} post={post} token={token} onNavigate={onNavigate} currentUser={currentUser} />)}</div>;
}

function EditProfileModal({ user, token, onClose, onSave }) {
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      const updated = await apiFetch("/users/me", token, {
        method: "PATCH",
        body: JSON.stringify({ displayName, bio, avatarUrl }),
      });
      onSave(updated);
      onClose();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  const inputStyle = { width: "100%", boxSizing: "border-box", background: "#0d1117", border: "1px solid #1e2733", borderRadius: 8, padding: "12px 14px", color: "#e7edf3", fontSize: 15, fontFamily: "'Sora', sans-serif", outline: "none", transition: "border-color 0.15s" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div style={{ background: "#0a0f1a", border: "1px solid #1e2733", borderRadius: 16, padding: 40, width: "100%", maxWidth: 480, boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, color: "#e7edf3", fontFamily: "'Sora', sans-serif", fontWeight: 800 }}>Edit Profile</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#4a5568", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ color: "#4a5568", fontSize: 12, fontFamily: "'DM Mono', monospace", display: "block", marginBottom: 6 }}>DISPLAY NAME</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#1d9bf0"} onBlur={e => e.target.style.borderColor = "#1e2733"} />
          </div>
          <div>
            <label style={{ color: "#4a5568", fontSize: 12, fontFamily: "'DM Mono', monospace", display: "block", marginBottom: 6 }}>BIO</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "'Sora', sans-serif" }}
              onFocus={e => e.target.style.borderColor = "#1d9bf0"} onBlur={e => e.target.style.borderColor = "#1e2733"} />
          </div>
          <div>
            <label style={{ color: "#4a5568", fontSize: 12, fontFamily: "'DM Mono', monospace", display: "block", marginBottom: 6 }}>AVATAR URL</label>
            <input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." style={inputStyle}
              onFocus={e => e.target.style.borderColor = "#1d9bf0"} onBlur={e => e.target.style.borderColor = "#1e2733"} />
            {avatarUrl && <img src={avatarUrl} alt="preview" style={{ width: 48, height: 48, borderRadius: "50%", marginTop: 8, objectFit: "cover" }} onError={e => e.target.style.display = "none"} />}
          </div>
        </div>
        {error && <p style={{ color: "#f87171", fontSize: 13, margin: "12px 0 0", fontFamily: "'DM Mono', monospace" }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, background: "none", color: "#e7edf3", border: "1px solid #1e2733", borderRadius: 9999, padding: 14, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'Sora', sans-serif" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: "#1d9bf0", color: "#fff", border: "none", borderRadius: 9999, padding: 14, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'Sora', sans-serif" }}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserListItem({ user, token, onNavigate }) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFollow = async (e) => {
    e.stopPropagation();
    if (!token || loading) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/posts/follow/${user.id}`, token, { method: "POST" });
      setFollowing(data.following);
    } catch {}
    setLoading(false);
  };

  return (
    <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e2733", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", transition: "background 0.15s" }}
      onClick={() => onNavigate("profile", user.username)}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <Avatar name={user.username} url={user.avatarUrl} size={44} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: "#e7edf3", fontSize: 15 }}>{user.displayName || user.username}</div>
        <div style={{ color: "#4a5568", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>@{user.username}</div>
        {user.bio && <div style={{ color: "#64748b", fontSize: 13, marginTop: 2 }}>{user.bio}</div>}
      </div>
      {token && (
        <button onClick={handleFollow} disabled={loading} style={{ background: following ? "none" : "#e7edf3", color: following ? "#e7edf3" : "#060b14", border: "2px solid #e7edf3", borderRadius: 9999, padding: "6px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Sora', sans-serif", flexShrink: 0 }}>
          {loading ? "..." : following ? "Following" : "Follow"}
        </button>
      )}
    </div>
  );
}

function ProfilePage({ username, token, currentUser, onNavigate, onUpdateUser }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [tab, setTab] = useState("posts");
  const [showEdit, setShowEdit] = useState(false);
  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    const load = async () => {
      setLoading(true); setTab("posts");
      setError(null);
      try {
        const [prof, userPosts, followerList, followingList] = await Promise.all([
          apiFetch(`/users/${username}`, token),
          apiFetch(`/users/${username}/posts`, token),
          apiFetch(`/users/${username}/followers`, token),
          apiFetch(`/users/${username}/following`, token),
        ]);
        setProfile(prof); setPosts(userPosts);
        setFollowers(followerList); setFollowing(followingList);
        if (token && currentUser) setIsFollowing(followerList.some(u => u.username === currentUser.username));
      } catch (e) {
        setProfile(null);
        setPosts([]);
        setFollowers([]);
        setFollowing([]);
        setError(e.message || "Could not load this profile.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [username, token, retryKey]);

  const handleFollow = async () => {
    if (!token || followLoading) return;
    setFollowLoading(true);
    try {
      const data = await apiFetch(`/posts/follow/${profile.id}`, token, { method: "POST" });
      setIsFollowing(data.following);
      setProfile(p => ({ ...p, followerCount: p.followerCount + (data.following ? 1 : -1) }));
      if (data.following) setFollowers(f => [...f, { id: currentUser.id, username: currentUser.username, displayName: currentUser.displayName, avatarUrl: currentUser.avatarUrl }]);
      else setFollowers(f => f.filter(u => u.username !== currentUser.username));
    } catch {}
    setFollowLoading(false);
  };

  const handleSaveProfile = (updated) => {
    setProfile(p => ({ ...p, ...updated }));
    onUpdateUser(updated);
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>Loading profile...</div>;
  if (error) return <LoadError title="Could not load profile" message={error} onRetry={() => setRetryKey(k => k + 1)} />;
  if (!profile) return <div style={{ padding: 40, textAlign: "center", color: "#f87171" }}>User not found.</div>;

  const tabs = [
    { key: "posts", label: "Posts", count: profile.postCount },
    { key: "followers", label: "Followers", count: profile.followerCount },
    { key: "following", label: "Following", count: profile.followingCount },
  ];

  return (
    <div>
      {showEdit && <EditProfileModal user={profile} token={token} onClose={() => setShowEdit(false)} onSave={handleSaveProfile} />}
      <div style={{ height: 120, background: "linear-gradient(135deg, #1d9bf030, #6366f130)", position: "relative" }}>
        <div style={{ position: "absolute", bottom: -32, left: 20 }}>
          <Avatar name={profile.username} url={profile.avatarUrl} size={64} />
        </div>
      </div>
      <div style={{ padding: "48px 20px 20px", borderBottom: "1px solid #1e2733" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, color: "#e7edf3", fontSize: 20, fontWeight: 800, fontFamily: "'Sora', sans-serif" }}>{profile.displayName || profile.username}</h2>
            <p style={{ margin: "2px 0 8px", color: "#4a5568", fontSize: 14, fontFamily: "'DM Mono', monospace" }}>@{profile.username}</p>
            {profile.bio && <p style={{ margin: "0 0 12px", color: "#c9d6e3", fontSize: 15, lineHeight: 1.5 }}>{profile.bio}</p>}
            <div style={{ display: "flex", gap: 20 }}>
              {tabs.map(({ key, label, count }) => (
                <button key={key} onClick={() => setTab(key)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <span style={{ fontSize: 14, color: tab === key ? "#e7edf3" : "#4a5568", fontFamily: "'DM Mono', monospace" }}>
                    <span style={{ color: "#e7edf3", fontWeight: 700 }}>{count ?? 0}</span> {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {isOwnProfile ? (
            <button onClick={() => setShowEdit(true)} style={{ background: "none", color: "#e7edf3", border: "2px solid #1e2733", borderRadius: 9999, padding: "8px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Sora', sans-serif", transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#4a5568"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#1e2733"}
            >Edit profile</button>
          ) : token && (
            <button onClick={handleFollow} disabled={followLoading} style={{ background: isFollowing ? "none" : "#e7edf3", color: isFollowing ? "#e7edf3" : "#060b14", border: "2px solid #e7edf3", borderRadius: 9999, padding: "8px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Sora', sans-serif" }}>
              {followLoading ? "..." : isFollowing ? "Following" : "Follow"}
            </button>
          )}
        </div>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid #1e2733" }}>
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "16px", background: "none", border: "none", color: tab === key ? "#e7edf3" : "#4a5568", fontWeight: tab === key ? 700 : 400, fontSize: 15, cursor: "pointer", fontFamily: "'Sora', sans-serif", borderBottom: tab === key ? "2px solid #1d9bf0" : "2px solid transparent", transition: "color 0.15s" }}>{label}</button>
        ))}
      </div>
      {tab === "posts" && (posts.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#4a5568" }}>No posts yet.</div> : posts.map(post => <PostCard key={post.id} post={post} token={token} onNavigate={onNavigate} currentUser={currentUser} />))}
      {tab === "followers" && (followers.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#4a5568" }}>No followers yet.</div> : followers.map(u => <UserListItem key={u.id} user={u} token={token} onNavigate={onNavigate} />))}
      {tab === "following" && (following.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#4a5568" }}>Not following anyone yet.</div> : following.map(u => <UserListItem key={u.id} user={u} token={token} onNavigate={onNavigate} />))}
    </div>
  );
}

function MessagesPage({ token, currentUser, onNavigate }) {
  const [inbox, setInbox] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [inboxError, setInboxError] = useState(null);
  const [threadError, setThreadError] = useState(null);
  const [sendError, setSendError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setInboxError(null);
    apiFetch("/messages/inbox", token)
      .then(data => {
        if (!cancelled) setInbox(data);
      })
      .catch(e => {
        if (!cancelled) {
          setInbox([]);
          setInboxError(e.message || "Could not load your inbox.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, retryKey]);

  useEffect(() => {
    if (!activeThread || !token) return;
    let cancelled = false;
    setThreadError(null);
    apiFetch(`/messages/${activeThread.id}`, token)
      .then(data => {
        if (!cancelled) setMessages(data);
      })
      .catch(e => {
        if (!cancelled) {
          setMessages([]);
          setThreadError(e.message || "Could not load this conversation.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeThread, token, retryKey]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      apiFetch(`/users/search?q=${encodeURIComponent(searchQuery)}`, token)
        .then(r => setSearchResults(r.filter(u => u.username !== currentUser?.username)))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleSend = async () => {
    if (!messageText.trim() || !activeThread || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const msg = await apiFetch(`/messages/${activeThread.id}`, token, { method: "POST", body: JSON.stringify({ text: messageText.trim() }) });
      setMessages(p => [...p, msg]);
      setMessageText("");
    } catch (e) {
      setSendError(e.message || "Could not send message.");
    }
    setSending(false);
  };

  const openThread = (user) => {
    setActiveThread(user);
    setThreadError(null);
    setSendError(null);
    setSearchQuery(""); setSearchResults([]);
    const existing = inbox.find(t => t.user.id === user.id);
    if (!existing) setInbox(p => [{ user, lastMessage: null }, ...p]);
  };

  if (!token) return <div style={{ padding: 40, textAlign: "center", color: "#4a5568" }}>Sign in to view messages.</div>;

  return (
    <div style={{ display: "flex", height: "calc(100vh - 60px)" }}>
      <div style={{ width: 320, borderRight: "1px solid #1e2733", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e2733" }}>
          <h2 style={{ margin: "0 0 12px", color: "#e7edf3", fontWeight: 800, fontFamily: "'Sora', sans-serif" }}>Messages</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0d1117", border: "1px solid #1e2733", borderRadius: 9999, padding: "8px 14px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a5568" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Find a person..."
              style={{ background: "none", border: "none", outline: "none", color: "#e7edf3", fontSize: 14, flex: 1, fontFamily: "'Sora', sans-serif" }}
            />
          </div>
          {searchResults.length > 0 && (
            <div style={{ marginTop: 8, background: "#0d1117", border: "1px solid #1e2733", borderRadius: 12, overflow: "hidden" }}>
              {searchResults.slice(0, 5).map(u => (
                <div key={u.id} style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", transition: "background 0.15s" }}
                  onClick={() => openThread(u)}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <Avatar name={u.username} url={u.avatarUrl} size={32} />
                  <div>
                    <div style={{ color: "#e7edf3", fontSize: 14, fontWeight: 600 }}>{u.displayName || u.username}</div>
                    <div style={{ color: "#4a5568", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>@{u.username}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? <div style={{ padding: 20, textAlign: "center", color: "#4a5568", fontSize: 13 }}>Loading...</div>
            : inboxError ? <LoadError title="Could not load messages" message={inboxError} onRetry={() => setRetryKey(k => k + 1)} />
            : inbox.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: "#4a5568", fontSize: 13 }}>No messages yet.</div>
            : inbox.map(thread => (
              <div key={thread.user.id} style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", background: activeThread?.id === thread.user.id ? "rgba(29,155,240,0.1)" : "transparent", transition: "background 0.15s", borderBottom: "1px solid #1e2733" }}
                onClick={() => openThread(thread.user)}
                onMouseEnter={e => { if (activeThread?.id !== thread.user.id) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                onMouseLeave={e => { if (activeThread?.id !== thread.user.id) e.currentTarget.style.background = "transparent"; }}
              >
                <Avatar name={thread.user.username} url={thread.user.avatarUrl} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#e7edf3", fontWeight: 700, fontSize: 14 }}>{thread.user.displayName || thread.user.username}</div>
                  {thread.lastMessage && <div style={{ color: "#4a5568", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{thread.lastMessage.text}</div>}
                </div>
                {thread.lastMessage && <div style={{ color: "#2d3748", fontSize: 11, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{timeAgo(thread.lastMessage.timestamp)}</div>}
              </div>
            ))
          }
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {!activeThread ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#4a5568" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
              <p style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 700, color: "#e7edf3" }}>Your messages</p>
              <p style={{ fontSize: 14, marginTop: 8 }}>Search for someone to start a conversation</p>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e2733", display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={activeThread.username} url={activeThread.avatarUrl} size={36} onClick={() => onNavigate("profile", activeThread.username)} />
              <div>
                <div style={{ color: "#e7edf3", fontWeight: 700 }}>{activeThread.displayName || activeThread.username}</div>
                <div style={{ color: "#4a5568", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>@{activeThread.username}</div>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              {threadError ? (
                <LoadError title="Could not load conversation" message={threadError} onRetry={() => setRetryKey(k => k + 1)} />
              ) : messages.map(msg => {
                const isMe = msg.senderId === currentUser?.id;
                return (
                  <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}>
                    {!isMe && <Avatar name={msg.sender?.username} url={msg.sender?.avatarUrl} size={28} />}
                    <div style={{ maxWidth: "70%" }}>
                      <div style={{ background: isMe ? "#1d9bf0" : "#1e2733", color: "#e7edf3", borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: "10px 14px", fontSize: 14, lineHeight: 1.5, wordBreak: "break-word" }}>
                        {msg.text}
                      </div>
                      <div style={{ color: "#2d3748", fontSize: 10, fontFamily: "'DM Mono', monospace", marginTop: 2, textAlign: isMe ? "right" : "left" }}>{timeAgo(msg.timestamp)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            {sendError && <div style={{ padding: "8px 20px 0", color: "#f87171", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>{sendError}</div>}
            <div style={{ padding: "12px 20px", borderTop: "1px solid #1e2733", display: "flex", gap: 10 }}>
              <input value={messageText} onChange={e => setMessageText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSend()}
                placeholder={`Message @${activeThread.username}...`}
                style={{ flex: 1, background: "#0d1117", border: "1px solid #1e2733", borderRadius: 9999, padding: "10px 16px", color: "#e7edf3", fontSize: 14, outline: "none", fontFamily: "'Sora', sans-serif" }}
              />
              <button onClick={handleSend} disabled={!messageText.trim() || sending} style={{ background: "#1d9bf0", color: "#fff", border: "none", borderRadius: 9999, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Sora', sans-serif", opacity: !messageText.trim() ? 0.5 : 1 }}>
                {sending ? "..." : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BookmarksPage({ token, onNavigate, currentUser }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setPosts([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch("/bookmarks", token)
      .then(data => {
        if (!cancelled) setPosts(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!cancelled) {
          setPosts([]);
          setError(e.message || "Could not load bookmarks.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, retryKey]);

  const onBookmarkChange = (postId, bookmarked) => {
    if (!bookmarked) setPosts(p => p.filter(x => x.id !== postId));
  };

  if (!token) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#4a5568" }}>
        <p style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 700, color: "#e7edf3" }}>Bookmarks</p>
        <p style={{ fontSize: 14, marginTop: 8 }}>Sign in to view your saved posts.</p>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#4a5568", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>Loading bookmarks...</div>;
  }
  if (error) {
    return <LoadError title="Could not load bookmarks" message={error} onRetry={() => setRetryKey(k => k + 1)} />;
  }

  if (!posts.length) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#4a5568" }}>
        <p style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 700, color: "#e7edf3" }}>No bookmarks yet</p>
        <p style={{ fontSize: 14, marginTop: 8 }}>Save posts from your feed with the bookmark button.</p>
      </div>
    );
  }

  return (
    <div>
      {posts.map(post => (
        <PostCard key={post.id} post={{ ...post, isBookmarked: true }} token={token} onNavigate={onNavigate} currentUser={currentUser} onBookmarkChange={onBookmarkChange} />
      ))}
    </div>
  );
}

function SearchPage({ token, onNavigate }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setError(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch(`/users/search?q=${encodeURIComponent(query)}`, token);
        if (!cancelled) setResults(data);
      }
      catch (e) {
        if (!cancelled) {
          setResults([]);
          setError(e.message || "Search failed.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, token]);

  return (
    <div>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e2733", position: "sticky", top: 60, background: "#060b14", zIndex: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#0d1117", border: "1px solid #1e2733", borderRadius: 9999, padding: "10px 16px" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a5568" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search users..."
            style={{ background: "none", border: "none", outline: "none", color: "#e7edf3", fontSize: 16, flex: 1, fontFamily: "'Sora', sans-serif" }}
          />
        </div>
      </div>
      {loading && <div style={{ padding: 20, textAlign: "center", color: "#4a5568", fontSize: 13 }}>Searching...</div>}
      {error && <LoadError title="Search failed" message={error} />}
      {results.map(user => <UserListItem key={user.id} user={user} token={token} onNavigate={onNavigate} />)}
      {!loading && !error && query && results.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#4a5568" }}>No users found for "{query}"</div>}
    </div>
  );
}

function NotificationsPage({ token }) {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch("/notifications", token)
      .then(data => {
        if (!cancelled) setNotifs(data);
      })
      .catch(e => {
        if (!cancelled) {
          setNotifs([]);
          setError(e.message || "Could not load notifications.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, retryKey]);

  if (!token) return <div style={{ padding: 40, textAlign: "center", color: "#4a5568" }}>Sign in to see notifications.</div>;
  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#4a5568", fontSize: 13 }}>Loading...</div>;
  if (error) return <LoadError title="Could not load notifications" message={error} onRetry={() => setRetryKey(k => k + 1)} />;
  if (!notifs.length) return (
    <div style={{ padding: 40, textAlign: "center", color: "#4a5568" }}>
      <p style={{ fontSize: 20, fontWeight: 700, color: "#e7edf3", fontFamily: "'Sora', sans-serif" }}>No notifications yet</p>
      <p style={{ fontSize: 14, marginTop: 8 }}>When someone likes or follows you, it'll show up here.</p>
    </div>
  );

  return (
    <div>
      {notifs.map(n => (
        <div key={n.id} style={{ padding: "16px 20px", borderBottom: "1px solid #1e2733", display: "flex", gap: 12, transition: "background 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <div style={{ fontSize: 20, width: 40, textAlign: "center", paddingTop: 2 }}>{n.type === "like" ? "❤️" : "👤"}</div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 4px", color: "#c9d6e3", fontSize: 15 }}>
              <span style={{ fontWeight: 700, color: "#e7edf3" }}>{n.actor?.displayName || n.actor?.username}</span>
              {n.type === "like" ? " liked your post" : " followed you"}
            </p>
            {n.post && <p style={{ margin: 0, color: "#4a5568", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>"{n.post.text?.substring(0, 60)}{n.post.text?.length > 60 ? "..." : ""}"</p>}
            <span style={{ color: "#2d3748", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>{timeAgo(n.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuthModal({ onAuth, onClose }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!username || !password) return;
    setLoading(true); setError(null);
    try {
      const body = mode === "register" ? { username, password, displayName: displayName || username } : { username, password };
      const data = await apiFetch(`/auth/${mode}`, null, { method: "POST", body: JSON.stringify(body) });
      onAuth(data.token, data.user);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const inputStyle = { width: "100%", boxSizing: "border-box", background: "#0d1117", border: "1px solid #1e2733", borderRadius: 8, padding: "12px 14px", color: "#e7edf3", fontSize: 15, fontFamily: "'Sora', sans-serif", outline: "none", transition: "border-color 0.15s" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div style={{ background: "#0a0f1a", border: "1px solid #1e2733", borderRadius: 16, padding: 40, width: "100%", maxWidth: 400, boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
          <h2 style={{ margin: 0, color: "#e7edf3", fontFamily: "'Sora', sans-serif", fontWeight: 800 }}>{mode === "login" ? "Sign in to LaBeouf" : "Join LaBeouf"}</h2>
        </div>
        <button onClick={() => { window.location.href = "/api/auth/google"; }} style={{ width: "100%", background: "#fff", color: "#1a1a1a", border: "none", borderRadius: 9999, padding: "12px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'Sora', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 }}
          onMouseEnter={e => e.currentTarget.style.background = "#e8e8e8"}
          onMouseLeave={e => e.currentTarget.style.background = "#fff"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: "#1e2733" }} />
          <span style={{ color: "#4a5568", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "#1e2733" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "register" && <input placeholder="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)} style={inputStyle} onFocus={e => e.target.style.borderColor = "#1d9bf0"} onBlur={e => e.target.style.borderColor = "#1e2733"} />}
          <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} onFocus={e => e.target.style.borderColor = "#1d9bf0"} onBlur={e => e.target.style.borderColor = "#1e2733"} />
          <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} onKeyDown={e => e.key === "Enter" && handleSubmit()} onFocus={e => e.target.style.borderColor = "#1d9bf0"} onBlur={e => e.target.style.borderColor = "#1e2733"} />
        </div>
        {error && <p style={{ color: "#f87171", fontSize: 13, margin: "12px 0 0", textAlign: "center", fontFamily: "'DM Mono', monospace" }}>{error}</p>}
        <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", marginTop: 16, background: "#1d9bf0", color: "#fff", border: "none", borderRadius: 9999, padding: 14, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "'Sora', sans-serif" }}>
          {loading ? "..." : mode === "login" ? "Sign in" : "Create account"}
        </button>
        <p style={{ textAlign: "center", marginTop: 20, color: "#4a5568", fontSize: 14 }}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => { setMode(m => m === "login" ? "register" : "login"); setError(null); }} style={{ background: "none", border: "none", color: "#1d9bf0", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

function LeftSidebar({ user, page, onNavigate, onSignIn, onSignOut, unreadCount }) {
  const navItems = [
    { icon: "⚡", label: "Home", page: "home" },
    { icon: "🔍", label: "Search", page: "search" },
    { icon: "🔖", label: "Bookmarks", page: "bookmarks" },
    { icon: "🔔", label: "Notifications", page: "notifications" },
    { icon: "✉️", label: "Messages", page: "messages", badge: unreadCount },
    ...(user?.role === "admin" ? [{ icon: "🛡️", label: "Admin", page: "admin" }] : []),
    { icon: "👤", label: "Profile", page: "profile", username: user?.username },
  ];

  return (
    <div style={{ width: 260, flexShrink: 0, padding: "12px 12px 12px 0", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #1d9bf0, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 8, marginLeft: 12 }}>⚡</div>
      <nav style={{ flex: 1 }}>
        {navItems.map(({ icon, label, page: p, username, badge }) => (
          (!username && p === "profile" && !user) ? null : (
            <button key={label} onClick={() => onNavigate(p, username)} style={{ display: "flex", alignItems: "center", gap: 16, width: "100%", background: page === p ? "rgba(255,255,255,0.08)" : "none", border: "none", padding: "12px 16px", borderRadius: 9999, color: "#e7edf3", fontSize: 18, cursor: "pointer", fontFamily: "'Sora', sans-serif", fontWeight: page === p ? 700 : 400, transition: "background 0.15s", position: "relative" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
              onMouseLeave={e => e.currentTarget.style.background = page === p ? "rgba(255,255,255,0.08)" : "none"}
            >
              <span style={{ fontSize: 22, position: "relative" }}>
                {icon}
                {badge > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#1d9bf0", color: "#fff", borderRadius: 9999, fontSize: 9, padding: "1px 4px", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{badge}</span>}
              </span>
              <span>{label}</span>
            </button>
          )
        ))}
      </nav>
      {user ? (
        <button style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", padding: "12px 16px", borderRadius: 9999, cursor: "pointer", transition: "background 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}
          onClick={onSignOut}
        >
          <Avatar name={user.username} url={user.avatarUrl} size={40} />
          <div style={{ textAlign: "left", flex: 1 }}>
            <div style={{ color: "#e7edf3", fontSize: 14, fontWeight: 700, fontFamily: "'Sora', sans-serif" }}>{user.displayName || user.username}</div>
            <div style={{ color: "#4a5568", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>@{user.username}</div>
          </div>
          <span style={{ color: "#4a5568", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>out</span>
        </button>
      ) : (
        <button onClick={onSignIn} style={{ background: "#1d9bf0", color: "#fff", border: "none", borderRadius: 9999, padding: "14px 24px", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "'Sora', sans-serif", width: "100%" }}>Sign in</button>
      )}
    </div>
  );
}

function RightSidebar({ token, onNavigate, currentUser }) {
  const [suggested, setSuggested] = useState([]);
  const [trending, setTrending] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [suggestedError, setSuggestedError] = useState(null);
  const [trendingError, setTrendingError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setTrendingLoading(true);
    setTrendingError(null);
    apiFetch("/posts/trending", null)
      .then(data => {
        if (!cancelled) setTrending(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!cancelled) {
          setTrending([]);
          setTrendingError(e.message || "Could not load trending posts.");
        }
      })
      .finally(() => {
        if (!cancelled) setTrendingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token || !currentUser) {
      setSuggested([]);
      setSuggestedError(null);
      return;
    }
    let cancelled = false;
    setSuggestedError(null);
    apiFetch("/users/search?q=a", token)
      .then(users => {
        if (!cancelled) setSuggested(users.filter(u => u.username !== currentUser.username).slice(0, 4));
      })
      .catch((e) => {
        if (!cancelled) {
          setSuggested([]);
          setSuggestedError(e.message || "Could not load suggestions.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, currentUser]);

  return (
    <div style={{ width: 320, flexShrink: 0, padding: "12px 0 12px 24px", position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
      <div style={{ background: "#0d1117", border: "1px solid #1e2733", borderRadius: 16, marginBottom: 16, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e2733" }}>
          <h2 style={{ margin: 0, color: "#e7edf3", fontSize: 18, fontWeight: 800, fontFamily: "'Sora', sans-serif" }}>Who to follow</h2>
        </div>
        {suggestedError
          ? <div style={{ padding: "16px 20px", color: "#f87171", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>{suggestedError}</div>
          : suggested.length === 0
          ? <div style={{ padding: "16px 20px", color: "#4a5568", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>{token ? "No suggestions yet." : "Sign in to see suggestions."}</div>
          : suggested.map(u => (
            <div key={u.id} style={{ padding: "12px 20px", borderBottom: "1px solid #1e2733", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", transition: "background 0.15s" }}
              onClick={() => onNavigate("profile", u.username)}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <Avatar name={u.username} url={u.avatarUrl} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ color: "#e7edf3", fontWeight: 700, fontSize: 14 }}>{u.displayName || u.username}</div>
                <div style={{ color: "#4a5568", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>@{u.username}</div>
              </div>
            </div>
          ))
        }
      </div>
      <div style={{ background: "#0d1117", border: "1px solid #1e2733", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e2733" }}>
          <h2 style={{ margin: 0, color: "#e7edf3", fontSize: 18, fontWeight: 800, fontFamily: "'Sora', sans-serif" }}>Trending</h2>
        </div>
        <div style={{ padding: "8px 0" }}>
          {trendingLoading ? (
            <div style={{ padding: "16px 20px", color: "#4a5568", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>Loading…</div>
          ) : trendingError ? (
            <div style={{ padding: "16px 20px", color: "#f87171", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>{trendingError}</div>
          ) : trending.length === 0 ? (
            <div style={{ padding: "16px 20px", color: "#4a5568", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>No trending posts yet.</div>
          ) : (
            trending.map(post => {
              const snippet = (post.text || "").length > 80 ? `${(post.text || "").slice(0, 80)}…` : (post.text || "");
              const author = post.author;
              return (
                <div
                  key={post.id}
                  style={{ padding: "12px 20px", borderBottom: "1px solid #1e2733", cursor: "pointer", transition: "background 0.15s" }}
                  onClick={() => author?.username && onNavigate("profile", author.username)}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <p style={{ margin: "0 0 6px", color: "#c9d6e3", fontSize: 14, lineHeight: 1.45, wordBreak: "break-word" }}>{snippet}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: "#64748b", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
                      {author?.displayName || author?.username || "Unknown"}
                      {author?.username && <span style={{ color: "#4a5568" }}> @{author.username}</span>}
                    </span>
                    <span style={{ color: "#ec4899", fontSize: 12, fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>❤ {post.likeCount ?? 0}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [page, setPage] = useState("home");
  const [pageParam, setPageParam] = useState(null);
  const [newPost, setNewPost] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callbackToken = params.get("token");
    const callbackUser = params.get("user");
    if (callbackToken && callbackUser) {
      try {
        const parsedUser = JSON.parse(decodeURIComponent(callbackUser));
        localStorage.setItem("lb_token", callbackToken);
        localStorage.setItem("lb_user", JSON.stringify(parsedUser));
        setToken(callbackToken); setUser(parsedUser);
        registerPushNotifications(callbackToken).catch(() => {});
        window.history.replaceState({}, "", "/");
      } catch {}
      return;
    }
    const savedToken = localStorage.getItem("lb_token");
    const savedUser = localStorage.getItem("lb_user");
    if (savedToken && savedUser) {
      try { setToken(savedToken); setUser(JSON.parse(savedUser)); }
      catch { localStorage.removeItem("lb_token"); localStorage.removeItem("lb_user"); }
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    const check = () => apiFetch("/messages/unread", token).then(d => setUnreadCount(d.count)).catch(() => {});
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiFetch("/users/me", token)
      .then((u) => {
        if (cancelled || !u) return;
        setUser((prev) => {
          const next = { ...(prev || {}), ...u };
          localStorage.setItem("lb_user", JSON.stringify(next));
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAuth = useCallback((tok, usr) => {
    localStorage.setItem("lb_token", tok);
    localStorage.setItem("lb_user", JSON.stringify(usr));
    setToken(tok); setUser(usr); setShowAuth(false);
    registerPushNotifications(tok).catch(() => {});
  }, []);

  const handleSignOut = useCallback(() => {
    localStorage.removeItem("lb_token"); localStorage.removeItem("lb_user");
    setToken(null); setUser(null); setPage("home");
  }, []);

  const handleNavigate = useCallback((pg, param = null) => {
    if (pg === "profile" && !param) return;
    if (pg === "hashtag" && !param) return;
    if (pg === "admin" && user?.role !== "admin") return;
    setPage(pg); setPageParam(param); window.scrollTo(0, 0);
  }, [user?.role]);

  const handleUpdateUser = useCallback((updated) => {
    setUser((prev) => {
      const next = { ...(prev || {}), ...updated };
      localStorage.setItem("lb_user", JSON.stringify(next));
      return next;
    });
  }, []);

  const pageTitle = { home: "Home", search: "Search", bookmarks: "Bookmarks", notifications: "Notifications", messages: "Messages", admin: "Admin", profile: pageParam ? `@${pageParam}` : "Profile", hashtag: pageParam ? `#${pageParam}` : "Hashtag" }[page] ?? "Home";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        body { background: #060b14; color: #e7edf3; font-family: 'Sora', sans-serif; -webkit-font-smoothing: antialiased; }
        textarea, input { font-family: 'Sora', sans-serif; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e2733; border-radius: 3px; }
        * { scrollbar-width: thin; scrollbar-color: #1e2733 transparent; }
        @media (max-width: 1024px) {
          .right-sidebar { display: none !important; }
        }
        @media (max-width: 768px) {
          .left-sidebar { width: 60px !important; }
          .left-sidebar span:last-child { display: none !important; }
          .left-sidebar .user-info { display: none !important; }
          .main-content { margin-left: 0 !important; }
        }
        @media (max-width: 480px) {
          .left-sidebar { width: 48px !important; padding: 8px 4px !important; }
        }
      `}</style>

      {showAuth && <AuthModal onAuth={handleAuth} onClose={() => setShowAuth(false)} />}

      <div style={{ maxWidth: 1230, margin: "0 auto", display: "flex", minHeight: "100vh", padding: "0 8px" }}>
        <div className="left-sidebar" style={{ width: 260, flexShrink: 0, padding: "12px 12px 12px 0", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
          <LeftSidebar user={user} page={page} onNavigate={handleNavigate} onSignIn={() => setShowAuth(true)} onSignOut={handleSignOut} unreadCount={unreadCount} />
        </div>

        <main style={{ flex: 1, borderLeft: "1px solid #1e2733", borderRight: "1px solid #1e2733", minHeight: "100vh", minWidth: 0 }}>
          <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(6,11,20,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid #1e2733", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {page !== "home" && (
                <button onClick={() => handleNavigate("home")} style={{ background: "none", border: "none", color: "#e7edf3", cursor: "pointer", padding: "4px 8px", borderRadius: 9999, fontSize: 18 }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}
                >←</button>
              )}
              <h1 style={{ fontSize: 20, fontWeight: 800, color: "#e7edf3" }}>{pageTitle}</h1>
            </div>
            <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "#4a5568", background: "#0d1117", border: "1px solid #1e2733", padding: "4px 10px", borderRadius: 6, letterSpacing: "0.05em" }}>v1.6.1</div>
          </div>

          {page === "home" && (
            <>
              {token && <Composer token={token} onPost={p => setNewPost(p)} />}
              <Feed token={token} newPost={newPost} onNavigate={handleNavigate} currentUser={user} />
              {!token && (
                <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "linear-gradient(135deg, #1d9bf0, #6366f1)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, zIndex: 20 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>Don't miss what's happening</div>
                    <div style={{ fontSize: 13, opacity: 0.85 }}>Sign in to see your personalized feed</div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                    <button onClick={() => setShowAuth(true)} style={{ background: "#fff", color: "#1d9bf0", border: "none", borderRadius: 9999, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Sora', sans-serif" }}>Sign in</button>
                    <button onClick={() => setShowAuth(true)} style={{ background: "none", color: "#fff", border: "2px solid rgba(255,255,255,0.5)", borderRadius: 9999, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Sora', sans-serif" }}>Sign up</button>
                  </div>
                </div>
              )}
            </>
          )}
          {page === "search" && <SearchPage token={token} onNavigate={handleNavigate} />}
          {page === "hashtag" && <HashtagPage tag={pageParam} token={token} onNavigate={handleNavigate} currentUser={user} />}
          {page === "bookmarks" && <BookmarksPage token={token} onNavigate={handleNavigate} currentUser={user} />}
          {page === "notifications" && <NotificationsPage token={token} />}
          {page === "messages" && <MessagesPage token={token} currentUser={user} onNavigate={handleNavigate} />}
          {page === "profile" && <ProfilePage username={pageParam} token={token} currentUser={user} onNavigate={handleNavigate} onUpdateUser={handleUpdateUser} />}
          {page === "admin" && <AdminDashboard token={token} user={user} onNavigate={handleNavigate} onUserRefresh={handleUpdateUser} />}
        </main>

        {page !== "admin" && (
        <div className="right-sidebar" style={{ width: 320, flexShrink: 0, padding: "12px 0 12px 24px", position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
          <RightSidebar token={token} onNavigate={handleNavigate} currentUser={user} />
        </div>
        )}
      </div>
    </>
  );
}

export function AdminPage({ token, user }) {
  const [tab, setTab] = useState("reports");
  const [reports, setReports] = useState([]);
  const [logs, setLogs] = useState([]);
  const [reportStats, setReportStats] = useState(null);
  const [logStats, setLogStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
  const thStyle = { textAlign: "left", color: "#64748b", fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 600, padding: "10px 12px", borderBottom: "1px solid #1e2733", textTransform: "uppercase", letterSpacing: "0.05em" };
  const tdStyle = { color: "#c9d6e3", padding: "12px", borderBottom: "1px solid #1e2733", verticalAlign: "top" };
  const cardStyle = { background: "#0d1117", border: "1px solid #1e2733", borderRadius: 16, padding: 18 };

  const rowsFrom = (data) => Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
  const displayDate = (value) => value ? new Date(value).toLocaleString() : "—";
  const authorName = (row) => row.author?.displayName || row.author?.username || row.authorName || row.authorUsername || row.authorId || "—";

  const fetchReports = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch("/admin/reports", token);
      setReports(rowsFrom(data));
    } catch (e) {
      setError(e.message || "Failed to load reports.");
      setReports([]);
    }
    setLoading(false);
  }, [token]);

  const fetchLogs = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch("/admin/moderation-logs", token);
      setLogs(rowsFrom(data));
    } catch (e) {
      setError(e.message || "Failed to load moderation logs.");
      setLogs([]);
    }
    setLoading(false);
  }, [token]);

  const fetchStats = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [reportsData, logsData] = await Promise.all([
        apiFetch("/admin/reports/stats", token),
        apiFetch("/admin/moderation-logs/stats", token),
      ]);
      setReportStats(reportsData);
      setLogStats(logsData);
    } catch (e) {
      setError(e.message || "Failed to load stats.");
      setReportStats(null);
      setLogStats(null);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!token || user?.role !== "admin") return;
    if (tab === "reports") fetchReports();
    if (tab === "logs") fetchLogs();
    if (tab === "stats") fetchStats();
  }, [token, user?.role, tab, fetchReports, fetchLogs, fetchStats]);

  const updateReport = async (id, status) => {
    try {
      const updated = await apiFetch(`/admin/reports/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setReports(prev => prev.map(r => r.id === id ? { ...r, ...(updated || {}), status } : r));
    } catch (e) {
      setError(e.message || "Failed to update report.");
    }
  };

  if (!token || user?.role !== "admin") {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#4a5568" }}>
        <p style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 700, color: "#e7edf3" }}>Admin access required</p>
      </div>
    );
  }

  const statEntries = [
    ["Total reports", reportStats?.total ?? reportStats?.totalReports],
    ["Pending reports", reportStats?.pending],
    ["Approved reports", reportStats?.approved],
    ["Rejected reports", reportStats?.rejected],
    ["Moderation logs", logStats?.total ?? logStats?.totalLogs],
    ["Approved logs", logStats?.approved],
    ["Rejected logs", logStats?.rejected],
  ].filter(([, value]) => value != null);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          ["reports", "Reports"],
          ["logs", "Moderation Logs"],
          ["stats", "Stats"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{ background: tab === key ? "#1d9bf0" : "#0d1117", color: tab === key ? "#fff" : "#c9d6e3", border: "1px solid #1e2733", borderRadius: 9999, padding: "8px 14px", cursor: "pointer", fontFamily: "'Sora', sans-serif", fontWeight: 700 }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div style={{ marginBottom: 12, color: "#f87171", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>{error}</div>}
      {loading && <div style={{ padding: 24, textAlign: "center", color: "#4a5568", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>Loading...</div>}

      {!loading && tab === "reports" && (
        <div style={{ ...cardStyle, overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {["ID", "Content Type", "Reason", "Status", "Author", "Date", "Actions"].map(h => <th key={h} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr><td colSpan="7" style={{ ...tdStyle, textAlign: "center", color: "#4a5568" }}>No reports found.</td></tr>
              ) : reports.map(report => (
                <tr key={report.id}>
                  <td style={tdStyle}>{report.id}</td>
                  <td style={tdStyle}>{report.contentType || "—"}</td>
                  <td style={tdStyle}>{report.reason || "—"}</td>
                  <td style={tdStyle}>{report.status || "—"}</td>
                  <td style={tdStyle}>{authorName(report)}</td>
                  <td style={tdStyle}>{displayDate(report.createdAt || report.timestamp || report.date)}</td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    <button onClick={() => updateReport(report.id, "approved")} style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 9999, padding: "6px 10px", marginRight: 6, cursor: "pointer", fontWeight: 700 }}>Approve</button>
                    <button onClick={() => updateReport(report.id, "rejected")} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 9999, padding: "6px 10px", cursor: "pointer", fontWeight: 700 }}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === "logs" && (
        <div style={{ ...cardStyle, overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {["Content Type", "Decision", "Reason", "Detection Method", "Confidence", "Date"].map(h => <th key={h} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan="6" style={{ ...tdStyle, textAlign: "center", color: "#4a5568" }}>No moderation logs found.</td></tr>
              ) : logs.map(log => (
                <tr key={log.id}>
                  <td style={tdStyle}>{log.contentType || "—"}</td>
                  <td style={tdStyle}>{log.decision || "—"}</td>
                  <td style={tdStyle}>{log.reason || "—"}</td>
                  <td style={tdStyle}>{log.detectionMethod || "—"}</td>
                  <td style={tdStyle}>{log.confidence != null ? log.confidence : "—"}</td>
                  <td style={tdStyle}>{displayDate(log.createdAt || log.timestamp || log.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === "stats" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          {statEntries.length === 0 ? (
            <div style={{ ...cardStyle, color: "#4a5568" }}>No stats available.</div>
          ) : statEntries.map(([label, value]) => (
            <div key={label} style={cardStyle}>
              <div style={{ color: "#64748b", fontSize: 11, fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
              <div style={{ color: "#e7edf3", fontSize: 28, fontWeight: 800, marginTop: 8 }}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
