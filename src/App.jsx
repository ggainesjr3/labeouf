import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { collection, doc, setDoc, addDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import { 
  SystemIcon, Button, StatusIndicator, Card, SignalCard, 
  SearchInput, HealthNode, PersistenceIndicator, InferenceLog, AuditRow, Sparkline 
} from './Library';

function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (e) { return initialValue; }
  });
  const setValue = (v) => {
    const val = v instanceof Function ? v(storedValue) : v;
    setStoredValue(val);
    window.localStorage.setItem(key, JSON.stringify(val));
  };
  return [storedValue, setValue];
}

export default function App() {
  const [currentView, setCurrentView] = useLocalStorage('node_view', 'feed');
  const [searchQuery, setSearchQuery] = useLocalStorage('node_filter', '');
  const [signals, setSignals] = useState([]);
  const [newSignal, setNewSignal] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [inferenceData, setInferenceData] = useState([]);
  const [logs, setLogs] = useState([{ id: 1, timestamp: new Date().toLocaleTimeString(), action: "Mobile_Init", status: "success" }]);
  const [health, setHealth] = useState([
    { service: 'Firebase_Cloud', status: 'operational', latency: 45 },
    { service: 'Android_Native_Bridge', status: 'operational', latency: 2 }
  ]);

  const pushLog = useCallback((action, status = 'info') => {
    setLogs(prev => [{ id: Date.now(), timestamp: new Date().toLocaleTimeString(), action, status }, ...prev].slice(0, 10));
  }, []);

  // PERSISTENCE OBSERVER
  useEffect(() => {
    setIsSyncing(true);
    const t = setTimeout(() => setIsSyncing(false), 800);
    return () => clearTimeout(t);
  }, [currentView, searchQuery]);

  // REAL-TIME DATA & SIMULATORS
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'signals'), orderBy('timestamp', 'desc'), limit(25)), (snap) => {
      setSignals(snap.docs.map(d => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate().toLocaleTimeString() || "..." })));
    });

    const mlTimer = setInterval(() => {
      const labels = ['Lion', 'Zebra', 'Elephant', 'Gazelle'];
      setInferenceData(prev => [{
        id: Date.now(), 
        label: labels[Math.floor(Math.random() * labels.length)],
        confidence: 0.75 + Math.random() * 0.2,
        latency: Math.floor(Math.random() * 100) + 50
      }, ...prev].slice(0, 4));
    }, 5000);

    return () => { unsub(); clearInterval(mlTimer); };
  }, []);

  const filteredSignals = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return q ? signals.filter(s => s.sender?.toLowerCase().includes(q) || s.message?.toLowerCase().includes(q)) : signals;
  }, [signals, searchQuery]);

  const transmit = async (e) => {
    e.preventDefault();
    if (!newSignal.trim()) return;
    const msg = newSignal; setNewSignal('');
    try {
      await addDoc(collection(db, 'signals'), { sender: "MOBILE_ALPHA", message: msg, timestamp: new Date() });
      pushLog("Signal_Sent", "success");
    } catch (e) { pushLog("Transmit_Fail", "error"); }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-zinc-400 font-sans select-none overflow-hidden">
      {/* HEADER: iOS/Android Safe Area Support */}
      <header className="px-6 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] border-b border-zinc-900 bg-black/90 backdrop-blur-md sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <SystemIcon name="ShieldCheck" size={18} className="text-orange-600" glow />
          <h1 className="text-sm font-black tracking-tighter text-white uppercase">LaBeouf_Mobile</h1>
        </div>
        <div className="flex items-center gap-3">
          <PersistenceIndicator isSyncing={isSyncing} />
          <StatusIndicator status="online" />
        </div>
      </header>

      {/* VIEWPORT */}
      <main className="flex-1 overflow-y-auto px-5 py-6 pb-32">
        <div className="space-y-6 max-w-lg mx-auto">
          {currentView === 'feed' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Card title="ML_Stream">
                  <div className="space-y-1">{inferenceData.map(i => <InferenceLog key={i.id} {...i} />)}</div>
                </Card>
                <Card title="Network">
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-lg font-black text-white">45ms</span>
                    <Sparkline data={[40, 55, 45, 60, 42]} color="#10b981" />
                  </div>
                </Card>
              </div>

              <Card title="Broadcast">
                <form onSubmit={transmit} className="space-y-3">
                  <textarea className="w-full bg-black border border-zinc-800 p-3 text-white text-xs h-20 outline-none focus:border-orange-500 font-mono" placeholder="SIGNAL_DATA..." value={newSignal} onChange={e => setNewSignal(e.target.value)} />
                  <Button type="submit" icon="Send" className="w-full">Transmit</Button>
                </form>
              </Card>

              <div className="space-y-3">
                <SearchInput value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                {filteredSignals.map(s => <SignalCard key={s.id} {...s} />)}
              </div>
            </>
          ) : (
            <Card title="System_Audit">
              <div className="space-y-1">{logs.map(l => <AuditRow key={l.id} {...l} />)}</div>
            </Card>
          )}
        </div>
      </main>

      {/* NAV: Thumb-Friendly Bottom Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-[calc(env(safe-area-inset-bottom)+4rem)] bg-zinc-950 border-t border-zinc-900 flex justify-around items-start pt-3 z-50">
        <button onClick={() => setCurrentView('feed')} className={`flex flex-col items-center gap-1 ${currentView === 'feed' ? 'text-orange-500' : 'text-zinc-800'}`}>
          <SystemIcon name="Activity" glow={currentView === 'feed'} />
          <span className="text-[7px] font-black uppercase">Feed</span>
        </button>
        <button onClick={() => setCurrentView('audit')} className={`flex flex-col items-center gap-1 ${currentView === 'audit' ? 'text-orange-500' : 'text-zinc-800'}`}>
          <SystemIcon name="Terminal" glow={currentView === 'audit'} />
          <span className="text-[7px] font-black uppercase">Audit</span>
        </button>
      </nav>
    </div>
  );
}