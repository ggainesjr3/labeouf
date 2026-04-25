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
  const [notifStatus, setNotifStatus] = useState(Notification.permission);

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
          userName: user.displayName || 'OPERATOR',
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
          <button type="submit" style={isScanning ? scanningButtonStyle : postButtonStyle}>
            {isScanning ? ">>> ANALYZING..." : "DISPATCH"}
          </button>
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
const logListStyle = { display: 'flex', flexDirection: 'column', gap: '8px' };
const logEntryStyle = { borderLeft: '2px solid #222', padding: '8px 12px', background: '#050505' };
const logMetaStyle = { fontSize: '0.55rem', color: '#444', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' };
const textStyle = { margin: 0, fontSize: '0.85rem', color: '#bbb' };

export default Feed;