import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';

// Components
import Feed from './components/Feed';
import Profile from './components/Profile';

const App = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const login = () => signInWithPopup(auth, new GoogleAuthProvider());
  const logout = () => signOut(auth);

  return (
    <Router>
      <div style={appContainerStyle}>
        {/* --- TACTICAL NAVBAR --- */}
        <nav style={navStyle}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <Link to="/" style={linkStyle}>[ FEED ]</Link>
            <Link to="/profile" style={linkStyle}>[ PROFILE ]</Link>
          </div>
          
          {user ? (
            <button onClick={logout} style={authButtonStyle}>LOGOUT_{user.displayName?.toUpperCase()}</button>
          ) : (
            <button onClick={login} style={authButtonStyle}>INITIALIZE_AUTH</button>
          )}
        </nav>

        {/* --- ROUTING ENGINE --- */}
        <main style={{ padding: '20px' }}>
          <Routes>
            <Route path="/" element={user ? <Feed user={user} /> : <div style={msgStyle}>ACCESS DENIED: PLEASE AUTHENTICATE</div>} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

// --- BRUTALIST UI THEME ---
const appContainerStyle = {
  backgroundColor: '#0a0a0a',
  minHeight: '100vh',
  color: '#fff',
  fontFamily: 'monospace'
};

const navStyle = {
  padding: '20px',
  backgroundColor: '#000',
  borderBottom: '3px solid #fff',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  position: 'sticky',
  top: 0,
  zIndex: 100
};

const linkStyle = {
  color: '#fff',
  textDecoration: 'none',
  fontWeight: 'bold',
  fontSize: '1.1rem',
  letterSpacing: '1px'
};

const authButtonStyle = {
  backgroundColor: '#fff',
  color: '#000',
  border: 'none',
  padding: '8px 15px',
  fontWeight: 'bold',
  cursor: 'pointer',
  fontFamily: 'monospace'
};

const msgStyle = {
  textAlign: 'center',
  marginTop: '100px',
  fontSize: '1.5rem',
  border: '2px dashed #444',
  padding: '40px'
};

export default App;