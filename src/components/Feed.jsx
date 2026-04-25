import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { analyzePostTrust } from '../utils/trustGuard';
import { requestNotificationPermission } from '../utils/notifications';

const Feed = ({ user }) => {
  const [posts, setPosts] = useState([]);
  const [newPostText, setNewPostText] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [globalThreat, setGlobalThreat] = useState('LOW');

  useEffect(() => {
    // Initialize notification permissions on mount
    requestNotificationPermission();

    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(fetchedPosts);

      // --- THREAT DETECTION LOGIC ---
      const suspiciousCount = fetchedPosts.filter(p => !p.isVerified).length;
      const ratio = suspiciousCount / (fetchedPosts.length || 1);
      
      let newThreat = 'LOW';
      if (ratio > 0.5) newThreat = 'CRITICAL';
      else if (ratio > 0.2) newThreat = 'ELEVATED';

      // DEFENSIVE TRIGGER: Push notification if threat escalates to CRITICAL
      if (newThreat === 'CRITICAL' && globalThreat !== 'CRITICAL') {
        if (Notification.permission === "granted") {
          new Notification("[!] SYSTEM_ALERT", {
            body: "CRITICAL threat level detected. Security audit required.",
            tag: "threat-alert", // Overwrites previous alerts to prevent spam
            silent: false
          });
        }
      }
      
      setGlobalThreat(newThreat);
    });
    return () => unsubscribe();
  }, [globalThreat]); // Track threat state changes

  const handlePost = async (e) => {
    e.preventDefault();
    if (!newPostText.trim()) return;
    setIsScanning(true);
    
    setTimeout(async () => {
      const trustResults = analyzePostTrust(newPostText);
      try {
        await addDoc(collection(db, 'posts'), {
          text: newPostText,
          uid: user.uid,
          userName: user.displayName || 'ANON_OPERATOR',
          createdAt: serverTimestamp(),
          trustScore: trustResults.score,
          isVerified: trustResults.isVerified,
          flags: trustResults.flags
        });
        setNewPostText('');
      } catch (err) { console.error(err); }
      finally { setIsScanning(false); }
    }, 800);
  };

  return (
    <div style={appContainer}>
      <header style={headerStyle}>
        <div style={statusCard(globalThreat)}>
          <span style={labelStyle}>SYSTEM_THREAT_LEVEL</span>
          <div style={massiveStatus}>{globalThreat}</div>
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
        </div>
      </header>

      <main className="scroll-container" style={scrollArea}>
        <form onSubmit={handlePost} style={formStyle}>
          <div style={terminalHeaderStyle}>SECURE_UPLINK_v2.1</div>
          <textarea
            value={newPostText}
            onChange={(e) => setNewPostText(e.target.value)}
            placeholder="TYPE_MESSAGE_FOR_ANALYSIS..."
            style={textareaStyle}
            disabled={isScanning}
          />
          <button type="submit" style={isScanning ? scanningButtonStyle : postButtonStyle}>
            {isScanning ? ">>> ANALYZING_VECTORS..." : "DISPATCH_DATA"}
          </button>
        </form>

        <div style={logListStyle}>
          {posts.map(post => (
            <div key={post.id} style={logEntryStyle}>
              <div style={logMetaStyle}>
                <span>SRC: {post.userName?.toUpperCase()}</span>
                <span style={post.isVerified ? {color: '#0f0'} : {color: '#f00'}}>
                  [{post.isVerified ? "VERIFIED" : "WARNING"}]
                </span>
              </div>
              <p style={textStyle}>{post.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

// --- STYLES (Locked for Mobile) ---
const appContainer = { display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: '#000' };
const headerStyle = { padding: '10px', borderBottom: '2px solid #333', backgroundColor: '#000', zIndex: 10 };
const scrollArea = { flex: 1, padding: '15px', paddingBottom: '40px' };
const statusCard = (level) => ({
  border: '2px solid #fff', padding: '10px 15px', marginBottom: '10px',
  backgroundColor: level === 'CRITICAL' ? '#900' : level === 'ELEVATED' ? '#960' : '#000',
  transition: 'background-color 0.5s ease'
});
const miniStatRow = { display: 'flex', gap: '10px' };
const statBox = { flex: 1, border: '1px solid #444', padding: '8px', backgroundColor: '#111' };
const labelStyle = { fontSize: '0.6rem', color: '#888', fontWeight: 'bold', display: 'block' };
const massiveStatus = { fontSize: '1.4rem', fontWeight: '900', letterSpacing: '-1px' };
const smallValue = { fontSize: '1.1rem', fontFamily: 'monospace' };
const formStyle = { border: '1px solid #333', marginBottom: '20px', backgroundColor: '#000' };
const terminalHeaderStyle = { background: '#222', padding: '4px 10px', fontSize: '0.6rem', color: '#888' };
const textareaStyle = { width: '100%', height: '70px', background: '#000', color: '#0f0', border: 'none', padding: '10px', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: '16px' };
const postButtonStyle = { width: '100%', padding: '12px', background: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' };
const scanningButtonStyle = { ...postButtonStyle, background: '#444', color: '#888' };
const logListStyle = { display: 'flex', flexDirection: 'column', gap: '8px' };
const logEntryStyle = { border: '1px solid #222', padding: '10px', backgroundColor: '#050505' };
const logMetaStyle = { fontSize: '0.65rem', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', opacity: 0.8 };
const textStyle = { margin: 0, fontSize: '0.9rem', lineHeight: '1.3' };

export default Feed;