import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { analyzePostTrust } from '../utils/trustGuard';
import { requestNotificationPermission } from '../utils/notifications';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const Feed = ({ user }) => {
  const [posts, setPosts] = useState([]);
  const [newPostText, setNewPostText] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [globalThreat, setGlobalThreat] = useState('LOW');
  const [notifStatus, setNotifStatus] = useState(Notification.permission);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(fetchedPosts);

      const suspiciousCount = fetchedPosts.filter(p => !p.isVerified).length;
      const ratio = suspiciousCount / (fetchedPosts.length || 1);
      
      let newThreat = 'LOW';
      if (ratio > 0.5) newThreat = 'CRITICAL';
      else if (ratio > 0.2) newThreat = 'ELEVATED';

      if (newThreat === 'CRITICAL' && globalThreat !== 'CRITICAL') {
        if (Notification.permission === "granted") {
          new Notification("[!] SYSTEM_ALERT", {
            body: "CRITICAL threat level detected. Security audit required.",
            tag: "threat-alert"
          });
        }
      }
      setGlobalThreat(newThreat);
    });
    return () => unsubscribe();
  }, [globalThreat]);

  const handleManualNotif = async () => {
    const result = await requestNotificationPermission();
    setNotifStatus(result);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    setUploadError(null);
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadError('REJECTED: Only JPG, PNG, GIF, WEBP accepted.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('REJECTED: File exceeds 5 MB limit.');
      return;
    }

    setSelectedImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async (file) => {
    const filename = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `post-images/${filename}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const handlePost = async (e) => {
    e.preventDefault();
    if (!newPostText.trim() && !selectedImage) return;
    setIsScanning(true);
    
    setTimeout(async () => {
      const trustResults = analyzePostTrust(newPostText);
      try {
        let imageUrl = null;
        if (selectedImage) {
          imageUrl = await uploadImage(selectedImage);
        }

        const postData = {
          text: newPostText,
          uid: user.uid,
          userName: user.displayName || 'OPERATOR',
          createdAt: serverTimestamp(),
          trustScore: trustResults.score,
          isVerified: trustResults.isVerified,
          flags: trustResults.flags
        };
        if (imageUrl) postData.imageUrl = imageUrl;

        await addDoc(collection(db, 'posts'), postData);
        setNewPostText('');
        clearSelectedImage();
      } catch (err) { console.error(err); }
      finally { setIsScanning(false); }
    }, 800);
  };

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
        </div>

        {notifStatus !== 'granted' && (
          <button onClick={handleManualNotif} style={notifButtonStyle}>
            ACTIVATE_TACTICAL_ALERTS
          </button>
        )}

        <div style={miniStatRow}>
          <div style={statBox}>
            <span style={labelStyle}>LOGS</span>
            <div style={smallValue}>{posts.length}</div>
          </div>
          <div style={statBox}>
            <span style={labelStyle}>ANOMALIES</span>
            <div style={smallValue}>{posts.filter(p => !p.isVerified).length}</div>
          </div>
        </div>
      </header>

      <main className="scroll-container" style={scrollArea}>
        <form onSubmit={handlePost} style={formStyle}>
          <div style={terminalHeaderStyle}>SECURE_UPLINK_v3.0</div>
          <textarea
            value={newPostText}
            onChange={(e) => setNewPostText(e.target.value)}
            placeholder="INPUT_DATA_STREAM..."
            style={textareaStyle}
            disabled={isScanning}
          />

          {imagePreviewUrl && (
            <div style={previewContainerStyle}>
              <img src={imagePreviewUrl} alt="Attachment preview" style={previewImageStyle} />
              <button type="button" onClick={clearSelectedImage} style={removeImageBtnStyle}>✕</button>
            </div>
          )}
          {uploadError && <div style={uploadErrorStyle}>{uploadError}</div>}

          <div style={composerActionsStyle}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={attachButtonStyle}
              disabled={isScanning}
              title="Attach image"
            >📎</button>
            <button type="submit" style={isScanning ? scanningButtonStyle : postButtonStyle}>
              {isScanning ? ">>> ANALYZING..." : "DISPATCH"}
            </button>
          </div>
        </form>

        <div style={logListStyle}>
          {posts.map(post => (
            <div key={post.id} style={logEntryStyle}>
              <div style={logMetaStyle}>
                <span>SRC: {post.userName?.toUpperCase()}</span>
                <span style={post.isVerified ? {color: '#0f0'} : {color: '#f00'}}>
                  {post.isVerified ? "VERIFIED" : "!! THREAT !!"}
                </span>
              </div>
              <p style={textStyle}>{post.text}</p>
              {post.imageUrl && (
                <img src={post.imageUrl} alt="Post attachment" style={postImageStyle} />
              )}
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
const notifButtonStyle = { width: '100%', padding: '10px', background: '#0f0', color: '#000', border: 'none', fontWeight: 'bold', fontSize: '0.7rem', marginBottom: '10px' };
const miniStatRow = { display: 'flex', gap: '8px' };
const statBox = { flex: 1, border: '1px solid #222', padding: '6px', background: '#050505' };
const labelStyle = { fontSize: '0.55rem', color: '#555', fontWeight: 'bold' };
const smallValue = { fontSize: '1rem', color: '#eee', fontFamily: 'monospace' };
const formStyle = { border: '1px solid #222', marginBottom: '20px' };
const terminalHeaderStyle = { background: '#111', padding: '4px 10px', fontSize: '0.55rem', color: '#444' };
const textareaStyle = { width: '100%', height: '60px', background: '#000', color: '#0f0', border: 'none', padding: '10px', boxSizing: 'border-box', fontSize: '16px', outline: 'none' };
const postButtonStyle = { width: '100%', padding: '12px', background: '#eee', color: '#000', border: 'none', fontWeight: 'bold' };
const scanningButtonStyle = { ...postButtonStyle, background: '#222', color: '#444' };
const composerActionsStyle = { display: 'flex', alignItems: 'stretch' };
const attachButtonStyle = { padding: '12px 16px', background: '#111', border: 'none', borderRight: '1px solid #222', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 };
const previewContainerStyle = { position: 'relative', padding: '8px', background: '#0a0a0a', borderTop: '1px solid #222' };
const previewImageStyle = { maxHeight: '120px', maxWidth: '100%', objectFit: 'contain', display: 'block', border: '1px solid #333' };
const removeImageBtnStyle = { position: 'absolute', top: '4px', right: '4px', background: '#f00', color: '#fff', border: 'none', width: '22px', height: '22px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem', lineHeight: '22px', textAlign: 'center', padding: 0 };
const uploadErrorStyle = { padding: '4px 10px', background: '#400', color: '#f66', fontSize: '0.6rem', fontWeight: 'bold' };
const postImageStyle = { marginTop: '8px', maxWidth: '100%', maxHeight: '300px', objectFit: 'contain', display: 'block', border: '1px solid #222' };
const logListStyle = { display: 'flex', flexDirection: 'column', gap: '8px' };
const logEntryStyle = { borderLeft: '2px solid #222', padding: '8px 12px', background: '#050505' };
const logMetaStyle = { fontSize: '0.55rem', color: '#444', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' };
const textStyle = { margin: 0, fontSize: '0.85rem', color: '#bbb' };

export default Feed;