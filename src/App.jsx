import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase'; 
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { Heart, MessageSquare, Repeat, Share, LogOut, Image, Beef, Activity, Fingerprint, EyeOff, Globe, Radio } from 'lucide-react';

function App() {
  const [moo, setMoo] = useState("");
  const [feed, setFeed] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Fail-Safe Loading State
  const [imgUrl, setImgUrl] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [scope, setScope] = useState("GLOBAL");
  
  const LIMIT = 88;

  useEffect(() => {
    // Auth Listener
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false); // Kill loading state once we know who the user is
    });
    
    // Database Listener
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
    }, (error) => {
      console.error("Thermal Sync Error:", error);
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
        isRedacted: false,
        node: "PHILADELPHIA_CLUSTER"
      });
      setMoo(""); setImgUrl(""); setShowLinkInput(false);
    } catch (err) { console.error("Broadcast Error:", err); }
  };

  const handleRedact = async (id) => {
    await updateDoc(doc(db, "moos", id), { 
      isRedacted: true,
      content: "[REDACTED_BY_AUTHOR]",
      image: "" 
    });
  };

  const isOver = moo.length > LIMIT;

  return (
    <div className="min-h-screen bg-[#F1F3F5] pb-24 font-sans text-black">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full h-20 bg-white border-b-4 border-black z-50 flex items-center justify-between px-10">
        <div className="flex items-center gap-4">
          <Beef size={28} className="text-indigo-600" />
          <h1 className="font-black text-2xl tracking-tighter uppercase italic">LABEOUF</h1>
        </div>
        <div className="flex bg-slate-100 p-1 border border-black">
          <button onClick={() => setScope("GLOBAL")} className={`px-4 py-1 text-[10px] font-black transition-all ${scope === "GLOBAL" ? 'bg-black text-white' : 'text-slate-400'}`}>GLOBAL</button>
          <button onClick={() => setScope("LOCAL")} className={`px-4 py-1 text-[10px] font-black transition-all ${scope === "LOCAL" ? 'bg-black text-white' : 'text-slate-400'}`}>LOCAL_NODE</button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto pt-32 px-6">
        {loading ? (
          /* State 0: System Booting */
          <div className="flex flex-col items-center justify-center py-40">
            <Activity className="animate-spin text-indigo-600 mb-4" size={48} />
            <span className="tag-mono animate-pulse">INITIALIZING_PROTOCOL...</span>
          </div>
        ) : user ? (
          /* State 1: Authenticated View */
          <>
            <div className={`industrial-card border-t-8 ${isOver ? 'border-t-red-600' : 'border-t-black'}`}>
              <div className="flex justify-between items-center mb-6 text-slate-400">
                <span className="tag-mono">CONFRONTATION_BUFFER</span>
                <span className="font-mono text-xs font-black">{LIMIT - moo.length}</span>
              </div>
              <form onSubmit={handlePostMoo}>
                <textarea 
                  className="w-full bg-transparent border-none focus:ring-0 text-black placeholder-[#ADB5BD] text-6xl font-black uppercase tracking-tighter leading-[0.85] resize-none overflow-hidden"
                  placeholder="START BEEF"
                  rows="2"
                  value={moo}
                  onChange={(e) => setMoo(e.target.value)}
                />
                <div className="flex justify-between items-center mt-12 pt-8 border-t-2 border-black/5">
                  <div className="flex gap-4">
                    <button type="button" onClick={() => setShowLinkInput(!showLinkInput)} className="text-slate-300 hover:text-black transition-colors"><Image size={24} /></button>
                    <button type="button" onClick={() => signOut(auth)} className="text-slate-300 hover:text-red-600 transition-colors"><LogOut size={24} /></button>
                  </div>
                  <button type="submit" disabled={isOver || !moo.trim()} className="btn-moo">Moo</button>
                </div>
              </form>
            </div>

            <div className="space-y-6 mt-12">
              {feed.map((item, index) => (
                <div key={item.id} className={`industrial-card group border-l-8 transition-all ${item.isRedacted ? 'opacity-40 grayscale' : 'border-l-black'}`}>
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <img src={item.photo} className="w-8 h-8 grayscale border border-black" alt="id" />
                      <span className="font-black text-[11px] uppercase tracking-widest text-slate-400">@{item.author}</span>
                    </div>
                    {user?.uid === item.uid && !item.isRedacted && (
                      <button onClick={() => handleRedact(item.id)} className="text-slate-200 hover:text-red-600"><EyeOff size={16} /></button>
                    )}
                  </div>
                  <p className="text-display">{item.content}</p>
                  <div className="flex justify-between items-center mt-8 pt-4 border-t border-black/5">
                    <button onClick={() => updateDoc(doc(db, "moos", item.id), { likes: increment(1) })} className="tag-mono flex items-center gap-2">
                      <Heart size={16} className={item.likes > 0 ? 'fill-red-500 text-red-500' : 'text-slate-200'} />
                      <span className="text-black">{item.likes || 0}</span>
                    </button>
                    <span className="tag-mono text-[8px] opacity-30">RANK_{String(index + 1).padStart(2, '0')}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* State 2: Identification Required */
          <div className="industrial-card text-center py-24 border-8 border-double border-black bg-white shadow-[12px_12px_0px_rgba(0,0,0,1)]">
            <h2 className="text-5xl font-black uppercase tracking-tighter mb-8 leading-none">Authentication <br/> Required</h2>
            <p className="tag-mono mb-10 opacity-60 italic">IDENTITY_VERIFICATION_PENDING</p>
            <button 
              onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} 
              className="btn-moo text-2xl px-12 py-6 bg-black text-white hover:bg-indigo-600"
            >
              Sign In with Google
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;