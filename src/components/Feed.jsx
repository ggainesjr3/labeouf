import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { analyzePostTrust } from '../utils/trustGuard';
import { sendThreatAlert } from '../utils/notifications';
import { vibrate, isTouchDevice, getDeviceLocation, getCameraPhoto } from '../utils/mobile';

const Feed = ({ user, isOnline, isMobile }) => {
  const fileInputRef = useRef(null);
  const [posts, setPosts] = useState([]);
  const [newPostText, setNewPostText] = useState('');
  const [attachedImage, setAttachedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('UNKNOWN');
  const [isScanning, setIsScanning] = useState(false);
  const [globalThreat, setGlobalThreat] = useState('LOW');
  const [notifStatus] = useState(Notification.permission);
  const [cachedPosts, setCachedPosts] = useState([]); // For offline viewing
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [syncStatus, setSyncStatus] = useState('');

  useEffect(() => {
    const cached = JSON.parse(localStorage.getItem('labeouf_cached_posts') || '[]');
    setCachedPosts(cached);

    const offlinePosts = JSON.parse(localStorage.getItem('labeouf_offline_posts') || '[]');
    setOfflineQueue(offlinePosts);

    if (!isOnline) {
      setPosts(cached);
      return;
    }

    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Cache posts for offline use
      localStorage.setItem('labeouf_cached_posts', JSON.stringify(fetchedPosts.slice(0, 50))); // Cache last 50 posts
      setCachedPosts(fetchedPosts.slice(0, 50));
      setPosts(fetchedPosts);

      const suspiciousCount = fetchedPosts.filter(p => !p.isVerified).length;
      const ratio = suspiciousCount / (fetchedPosts.length || 1);

      let newThreat = 'LOW';
      if (ratio > 0.5) newThreat = 'CRITICAL';
      else if (ratio > 0.2) newThreat = 'ELEVATED';

      if (newThreat === 'CRITICAL' && globalThreat !== 'CRITICAL') {
        sendThreatAlert(newThreat, "CRITICAL threat level detected. Security audit required.");
        if (isMobile && isTouchDevice()) vibrate([200, 100, 200, 100, 200]); // Emergency pattern
      }
      setGlobalThreat(newThreat);
    });
    return () => unsubscribe();
  }, [globalThreat, isOnline, isMobile]);

  const handleAttachImage = async () => {
    if (window.Capacitor?.isNativePlatform?.()) {
      const photo = await getCameraPhoto();
      if (photo) {
        setAttachedImage(photo);
        setImagePreview(photo.dataUrl);
        return;
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedImage({ dataUrl: reader.result, fileName: file.name });
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleGetLocation = async () => {
    setLocationStatus('REQUESTING');
    const coords = await getDeviceLocation();

    if (coords) {
      setLocation(coords);
      setLocationStatus('LOCKED');
      if (isMobile && isTouchDevice()) vibrate([40, 30, 40]);
    } else {
      setLocationStatus('FAILED');
      if (isMobile && isTouchDevice()) vibrate([200, 100, 200]);
    }
  };

  const clearAttachment = () => {
    setAttachedImage(null);
    setImagePreview(null);
  };

  const uploadImage = async (image) => {
    if (!image?.dataUrl) return null;

    const imageRef = storageRef(storage, `post-images/${user.uid}/${image.fileName || `photo-${Date.now()}.jpeg`}`);
    await uploadString(imageRef, image.dataUrl, 'data_url');
    return await getDownloadURL(imageRef);
  };

  const handlePost = async (e) => {
    e.preventDefault();
    if (!newPostText.trim()) return;

    if (isMobile && isTouchDevice()) vibrate([50]); // Feedback on post attempt

    const postPayload = {
      text: newPostText,
      uid: user.uid,
      userName: user.displayName || 'OPERATOR',
      location,
      imageName: attachedImage?.fileName || null,
      flags: ['user_submission']
    };

    if (!isOnline) {
      const offlinePost = {
        ...postPayload,
        createdAt: new Date().toISOString(),
        trustScore: 0,
        isVerified: false,
        imageData: attachedImage?.dataUrl || null,
        offline: true,
        flags: [...postPayload.flags, 'offline', attachedImage ? 'image_attached' : null].filter(Boolean)
      };

      const cachedOffline = JSON.parse(localStorage.getItem('labeouf_offline_posts') || '[]');
      cachedOffline.push(offlinePost);
      localStorage.setItem('labeouf_offline_posts', JSON.stringify(cachedOffline));
      setOfflineQueue(cachedOffline);

      setNewPostText('');
      clearAttachment();
      setLocation(null);
      setLocationStatus('UNKNOWN');
      alert('Post cached for sync when online');
      return;
    }

    setIsScanning(true);

    setTimeout(async () => {
      const trustResults = analyzePostTrust(newPostText);
      try {
        const imageURL = attachedImage ? await uploadImage(attachedImage) : null;

        await addDoc(collection(db, 'posts'), {
          ...postPayload,
          createdAt: serverTimestamp(),
          trustScore: trustResults.score,
          isVerified: trustResults.isVerified,
          flags: [...trustResults.flags, ...postPayload.flags, location ? 'location_locked' : null].filter(Boolean),
          imageURL
        });

        setNewPostText('');
        clearAttachment();
        setLocation(null);
        setLocationStatus('UNKNOWN');

        if (isMobile && isTouchDevice()) vibrate([100, 50, 100]); // Success pattern
      } catch (err) {
        console.error(err);
        if (isMobile && isTouchDevice()) vibrate([200, 200, 200]); // Error pattern
      } finally {
        setIsScanning(false);
      }
    }, 800);
  };

  const uploadOfflineImage = async (post) => {
    if (!post.imageData) return null;
    const imageRef = storageRef(storage, `post-images/${post.uid}/${post.imageName || `photo-${Date.now()}.jpeg`}`);
    await uploadString(imageRef, post.imageData, 'data_url');
    return await getDownloadURL(imageRef);
  };

  // Sync offline posts when coming back online
  useEffect(() => {
    const syncOfflinePosts = async () => {
      const offlinePosts = JSON.parse(localStorage.getItem('labeouf_offline_posts') || '[]');
      if (offlinePosts.length === 0) return;

      setSyncStatus('SYNCING OFFLINE POSTS');
      const synced = [];

      for (const post of offlinePosts) {
        try {
          const trustResults = analyzePostTrust(post.text);
          const imageURL = post.imageData ? await uploadOfflineImage(post) : null;

          await addDoc(collection(db, 'posts'), {
            text: post.text,
            uid: post.uid,
            userName: post.userName,
            createdAt: serverTimestamp(),
            trustScore: trustResults.score,
            isVerified: trustResults.isVerified,
            flags: [...trustResults.flags, 'synced', ...(post.flags || [])].filter(Boolean),
            imageURL,
            imageName: post.imageName || null,
            location: post.location || null
          });

          synced.push(post);
        } catch (err) {
          console.error('Failed to sync offline post:', err);
        }
      }

      if (synced.length > 0) {
        localStorage.removeItem('labeouf_offline_posts');
        setOfflineQueue([]);
        if (isMobile && isTouchDevice()) vibrate([100, 100, 100, 100]); // Sync success
      }

      setSyncStatus('');
    };

    if (isOnline) {
      syncOfflinePosts();
    }
  }, [isOnline, isMobile]);

  return (
    <div style={appContainer}>
      <header style={headerStyle}>
        <div style={statusCard(globalThreat)}>
          <div style={statusHeader}>
            <span style={labelStyle}>SYSTEM_THREAT_LEVEL</span>
            {/* Minimalist Notif Indicator */}
            <span style={notifIndicator(notifStatus)}>
              {notifStatus === 'granted' ? "● UPLINK_ACTIVE" : "○ UPLINK_OFFLINE"}
            </span>
          </div>
          <div style={massiveStatus}>{globalThreat}</div>
          {!isOnline && (
            <div style={{...labelStyle, color: '#ff6600', marginTop: '4px'}}>
              OFFLINE_MODE
            </div>
          )}
        </div>

        <div style={miniStatRow}>
          <div style={statBox}>
            <span style={labelStyle}>LOGS</span>
            <div style={smallValue}>{posts.length}</div>
          </div>
          <div style={statBox}>
            <span style={labelStyle}>ANOMALIES</span>
            <div style={smallValue}>{posts.filter(p => !p.isVerified).length}</div>
          </div>
          {!isOnline && (
            <div style={statBox}>
              <span style={labelStyle}>CACHED</span>
              <div style={smallValue}>{cachedPosts.length}</div>
            </div>
          )}
          {offlineQueue.length > 0 && (
            <div style={statBox}>
              <span style={labelStyle}>QUEUE</span>
              <div style={smallValue}>{offlineQueue.length}</div>
            </div>
          )}
        </div>
      </header>

      <main className="scroll-container" style={scrollArea}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <form onSubmit={handlePost} style={formStyle}>
          <div style={terminalHeaderStyle}>
            {isOnline ? 'SECURE_UPLINK_v3.0' : 'OFFLINE_CACHE_MODE'}
          </div>

          <div style={actionRowStyle}>
            <button
              type="button"
              onClick={handleAttachImage}
              style={actionButtonStyle}
              className="touch-feedback"
            >
              {attachedImage ? 'REPLACE_IMAGE' : 'ATTACH_IMAGE'}
            </button>
            <button
              type="button"
              onClick={handleGetLocation}
              style={actionButtonStyle}
              className="touch-feedback"
            >
              {locationStatus === 'LOCKED' ? 'LOCATION_LOCKED' : 'LOCK_LOCATION'}
            </button>
            {attachedImage && (
              <button
                type="button"
                onClick={clearAttachment}
                style={{ ...actionButtonStyle, backgroundColor: '#222', color: '#0f0' }}
                className="touch-feedback"
              >
                CLEAR_ATTACHMENT
              </button>
            )}
          </div>

          {attachedImage && (
            <div style={imagePreviewContainerStyle}>
              <img src={imagePreview} alt="Attached" style={imagePreviewStyle} />
            </div>
          )}

          {locationStatus !== 'UNKNOWN' && (
            <div style={locationStatusStyle}>
              {locationStatus === 'LOCKED' ? `LOC: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'GEolocation failed'}
            </div>
          )}

          <textarea
            value={newPostText}
            onChange={(e) => setNewPostText(e.target.value)}
            placeholder={isOnline ? "INPUT_DATA_STREAM..." : "OFFLINE_MODE: POST_WILL_BE_CACHED..."}
            style={textareaStyle}
            disabled={isScanning}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          <button
            type="submit"
            style={isScanning ? scanningButtonStyle : (isOnline ? postButtonStyle : offlinePostButtonStyle)}
            disabled={!isOnline && !newPostText.trim()}
            className="touch-feedback"
          >
            {isScanning ? ">>> ANALYZING..." : isOnline ? "DISPATCH" : "CACHE"}
          </button>

          {syncStatus && <div style={syncStatusStyle}>{syncStatus}</div>}
        </form>

        <div style={logListStyle}>
          {posts.map(post => (
            <div key={post.id} style={logEntryStyle}>
              <div style={logMetaStyle}>
                <span>SRC: {post.userName?.toUpperCase()}</span>
                <span style={post.isVerified ? {color: '#0f0'} : {color: '#f00'}}>
                  {post.isVerified ? "VERIFIED" : "!! THREAT !!"}
                </span>
                {post.offline && <span style={{color: '#ff6600'}}>OFFLINE</span>}
              </div>
              <p style={textStyle}>{post.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

// --- REFINED STYLES ---
const appContainer = { display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: '#000', overflow: 'hidden' };
const headerStyle = { padding: '12px', borderBottom: '1px solid #222' };
const scrollArea = { flex: 1, padding: '12px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' };
const statusHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' };
const statusCard = (level) => ({
  border: '1px solid #fff', padding: '12px', marginBottom: '10px',
  backgroundColor: level === 'CRITICAL' ? '#400' : level === 'ELEVATED' ? '#320' : '#0a0a0a',
  transition: 'background-color 0.4s ease'
});
const notifIndicator = (status) => ({
  fontSize: '0.5rem', color: status === 'granted' ? '#0f0' : '#f00', fontWeight: 'bold'
});
const massiveStatus = { fontSize: '1.8rem', fontWeight: '900', color: '#fff' };
const miniStatRow = { display: 'flex', gap: '8px', flexWrap: 'wrap' };
const statBox = { flex: 1, minWidth: '80px', border: '1px solid #222', padding: '6px', background: '#050505' };
const labelStyle = { fontSize: '0.55rem', color: '#555', fontWeight: 'bold' };
const smallValue = { fontSize: '1rem', color: '#eee', fontFamily: 'monospace' };
const formStyle = { border: '1px solid #222', marginBottom: '20px' };
const terminalHeaderStyle = { background: '#111', padding: '4px 10px', fontSize: '0.55rem', color: '#444' };
const actionRowStyle = { display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '12px 0' };
const actionButtonStyle = { flex: 1, minWidth: '120px', padding: '10px', background: '#111', color: '#0f0', border: '1px solid #0f0', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' };
const imagePreviewContainerStyle = { border: '1px solid #222', padding: '8px', marginBottom: '12px', background: '#050505' };
const imagePreviewStyle = { width: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: '4px' };
const locationStatusStyle = { marginBottom: '10px', padding: '8px', background: '#111', color: '#0f0', fontSize: '0.8rem', border: '1px solid #222' };
const syncStatusStyle = { marginTop: '10px', padding: '8px', background: '#111', color: '#ff0', fontSize: '0.8rem', border: '1px solid #333' };
const textareaStyle = {
  width: '100%', height: '60px', background: '#000', color: '#0f0', border: 'none',
  padding: '10px', boxSizing: 'border-box', fontSize: '16px', outline: 'none',
  resize: 'none', fontFamily: 'monospace'
};
const postButtonStyle = { width: '100%', padding: '12px', background: '#eee', color: '#000', border: 'none', fontWeight: 'bold' };
const offlinePostButtonStyle = { ...postButtonStyle, background: '#ff6600', color: '#000' };
const scanningButtonStyle = { ...postButtonStyle, background: '#222', color: '#444' };
const logListStyle = { display: 'flex', flexDirection: 'column', gap: '8px' };
const logEntryStyle = { borderLeft: '2px solid #222', padding: '8px 12px', background: '#050505' };
const logMetaStyle = { fontSize: '0.55rem', color: '#444', display: 'flex', justifyContent: 'space-between', marginBottom: '4px', flexWrap: 'wrap', gap: '4px' };
const textStyle = { margin: 0, fontSize: '0.85rem', color: '#bbb', wordWrap: 'break-word' };

export default Feed;