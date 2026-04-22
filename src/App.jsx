import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase'; 
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { Heart, MessageSquare, Repeat, Share, LogOut, Image, Beef, Activity, Fingerprint, EyeOff, Globe, Radio } from 'lucide-react';

function App() {
  const [moo, setMoo] = useState("");
  const [feed, setFeed] = useState([]);
  const [user, setUser] = useState(null);
  const [imgUrl, setImgUrl] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [scope, setScope] = useState("GLOBAL"); // Network Expansion State
  
  const LIMIT = 88;

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => setUser(u));
    const q = query(collection(db, "moos"), orderBy("createdAt", "desc"));
    
    const unsubFeed = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const moosData = snapshot.docs.map(d => {
        const data = d.data();
        const createdAt = data.createdAt?.toDate() || now;
        const hoursOld = (now - createdAt) / (1000 * 60 * 60);
        const heatScore = (data.likes || 0) / Math.pow((hoursOld + 2), 1.5);
        return { ...data, id: d.id, heatScore };
      });

      const sortedByHeat = moosData.sort((a, b) => b.heatScore - a.heatScore);
      setFeed(sortedByHeat);
    });

    return () => { unsubAuth(); unsubFeed(); };
  }, []);

  const handlePostMoo = async (e) => {
    e.preventDefault();
    if (!moo.trim() || moo.length > LIMIT) return;
    try {
      await addDoc(collection(db, "moos"), {
        content: moo.trim(), 
        author: user.displayName, 
        photo: user.photoURL, 
        image: imgUrl.trim(),
        uid: user.uid, 
        createdAt: serverTimestamp(), 
        likes: 0,
        isRedacted: false, // Redaction Flag
        node: "PHILADELPHIA_CLUSTER" // Network Expansion Label
      });
      setMoo(""); setImgUrl(""); setShowLinkInput(false);
    } catch (err) { console.error(err); }
  };

  // Logic: Redact function (Update, don't delete)
  const handleRedact = async (id) => {
    await updateDoc(doc(db, "moos", id), { 
      isRedacted: true,
      content: "[REDACTED_BY_AUTHOR]",
      image: "" 
    });
  };

  const isOver = moo.length > LIMIT;

  return (
    <div className="min-h-screen bg-[#F1F3F5] pb-24 font-sans">
      <nav className="fixed top-0 left-0 w-full h-20 bg-white border-b-4 border-black z-50 flex items-center justify-between px-10">
        <div className="flex items-center gap-4">
          <Beef size={28} className="text-indigo-600" />
          <h1 className="font-black text-2xl tracking-tighter uppercase italic">LABEOUF</h1>
        </div>
        
        {/* Network Expansion Toggle */}
        <div className="flex bg-slate-100 p-1 border border-black">
          <button onClick={() => setScope("GLOBAL")} className={`px-4 py-1 flex items-center gap-2 text-[10px] font-black transition-all ${scope === "GLOBAL" ? 'bg-black text-white' : 'text-slate-400 hover:text-black'}`}>
            <Globe size={12} /> GLOBAL
          </button>
          <button onClick={() => setScope("LOCAL")} className={`px-4 py-1 flex items-center gap-2 text-[10px] font-black transition-all ${scope === "LOCAL" ? 'bg-black text-white' : 'text-slate-400 hover:text-black'}`}>
            <Radio size={12} /> LOCAL_NODE
          </button>
        </div>

        <div>
          {user && <button onClick={() => signOut(auth)} className="tag-mono hover:text-black border-2 border-black px-4 py-1">Sign Out</button>}
        </div>
      </nav>

      <main className="max-w-2xl mx-auto pt-32 px-6">
        {user ? (
          <div className={`industrial-card border-t-8 ${isOver ? 'border-t-red-600' : 'border-t-black'}`}>
            <div className="flex justify-between items-center mb-6">
              <span className="tag-mono">BROADCAST_MOD_01</span>
              <span className="font-mono text-xs font-black">{LIMIT - moo.length}</span>
            </div>
            <form onSubmit={handlePostMoo}>
              <textarea 
                className="w-full bg-transparent border-none focus:ring-0 text-black placeholder-[#ADB5BD] text-6xl font-black uppercase tracking-tighter leading-[0.85] resize-none overflow-hidden"
                placeholder="START BEEF"
                value={moo}
                onChange={(e) => setMoo(e.target.value)}
              />
              <div className="flex justify-between items-center mt-12 pt-8 border-t-2 border-black/5">
                <button type="button" onClick={() => setShowLinkInput(!showLinkInput)} className="p-2 text-slate-300 hover:text-black"><Image size={28} /></button>
                <button type="submit" disabled={isOver || !moo.trim()} className="btn-moo">Moo</button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="space-y-6">
          {feed.map((item, index) => (
            <div key={item.id} className={`industrial-card group ${item.isRedacted ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <img src={item.photo} className="w-8 h-8 grayscale border border-black" alt="id" />
                  <span className="font-black text-[11px] uppercase text-slate-400">@{item.author}</span>
                </div>
                
                {/* Auth Check for Redaction */}
                {user?.uid === item.uid && !item.isRedacted && (
                  <button onClick={() => handleRedact(item.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                    <EyeOff size={16} />
                  </button>
                )}
              </div>

              <p className={`text-display ${item.isRedacted ? 'bg-black text-black' : ''}`}>
                {item.content}
              </p>

              <div className="mt-10 pt-6 border-t border-black/5 flex justify-between items-center">
                 <span className="tag-mono text-[8px]">{item.node || 'EXT_NODE'}</span>
                 <span className="tag-mono text-[8px]">RANK_{String(index + 1).padStart(2, '0')}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;