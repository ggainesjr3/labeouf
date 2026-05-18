import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';

// Components
import Feed from './components/Feed';
import Profile from './components/Profile';

// Mobile utilities
import {
  useOnlineStatus,
  useInstallPrompt,
  useViewportHeight,
  isPWA,
  isMobile,
  vibrate
} from './utils/mobile';

// Styles
const appContainerStyle = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  width: '100vw',
  backgroundColor: '#000',
  position: 'relative'
};

const navStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px',
  borderBottom: '1px solid #222',
  backgroundColor: '#000',
  position: 'sticky',
  top: 0,
  zIndex: 10
};

const linkStyle = {
  color: '#0f0',
  textDecoration: 'none',
  fontWeight: 'bold',
  padding: '8px 12px',
  border: '1px solid #222',
  backgroundColor: '#000',
  transition: 'all 0.2s ease'
};

const authButtonStyle = {
  color: '#000',
  backgroundColor: '#0f0',
  border: '1px solid #0f0',
  padding: '8px 16px',
  fontWeight: 'bold',
  cursor: 'pointer',
  fontSize: '12px',
  transition: 'all 0.2s ease'
};

const msgStyle = {
  color: '#f00',
  fontSize: '18px',
  textAlign: 'center',
  marginTop: '50px'
};

const offlineIndicatorStyle = {
  position: 'fixed',
  top: 'var(--safe-top, 0px)',
  left: 0,
  right: 0,
  background: '#f00',
  color: '#000',
  textAlign: 'center',
  padding: '4px',
  fontSize: '12px',
  fontWeight: 'bold',
  zIndex: 1000,
  animation: 'slideDown 0.3s ease-out'
};

const installPromptStyle = {
  position: 'fixed',
  bottom: 'var(--safe-bottom, 0px)',
  left: 0,
  right: 0,
  background: '#222',
  borderTop: '1px solid #444',
  padding: '12px',
  zIndex: 1000,
  animation: 'slideUp 0.3s ease-out',
  textAlign: 'center'
};

const installButtonStyle = {
  backgroundColor: '#0f0',
  color: '#000',
  border: '1px solid #0f0',
  padding: '8px 16px',
  margin: '0 4px',
  fontWeight: 'bold',
  cursor: 'pointer',
  fontSize: '14px'
};

const dismissButtonStyle = {
  backgroundColor: '#444',
  color: '#fff',
  border: '1px solid #444',
  padding: '8px 16px',
  margin: '0 4px',
  fontWeight: 'bold',
  cursor: 'pointer',
  fontSize: '14px'
};

const App = () => {
  const [user, setUser] = useState(null);
  const [isPWAMode, setIsPWAMode] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  // Mobile hooks
  const isOnline = useOnlineStatus();
  const { showPrompt, installApp, dismissPrompt } = useInstallPrompt();

  // Initialize viewport height fix
  useViewportHeight();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    // Detect PWA and mobile
    setIsPWAMode(isPWA());
    setIsMobileDevice(isMobile());

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      if (isMobileDevice) vibrate([50]); // Haptic feedback
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const logout = async () => {
    try {
      if (isMobileDevice) vibrate([50, 50, 50]); // Haptic feedback
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleInstallClick = () => {
    if (isMobileDevice) vibrate([100]); // Haptic feedback
    installApp();
  };

  const handleDismissInstall = () => {
    if (isMobileDevice) vibrate([50]); // Haptic feedback
    dismissPrompt();
  };

  return (
    <Router>
      <div style={appContainerStyle}>
        {/* OFFLINE INDICATOR */}
        {!isOnline && (
          <div style={offlineIndicatorStyle}>
            OFFLINE_MODE: LIMITED_FUNCTIONALITY
          </div>
        )}

        {/* PWA INSTALL PROMPT */}
        {showPrompt && !isPWAMode && (
          <div style={installPromptStyle}>
            <div style={{ marginBottom: '8px', fontSize: '14px' }}>
              INSTALL_APP: ENHANCED_EXPERIENCE
            </div>
            <button
              style={installButtonStyle}
              onClick={handleInstallClick}
              className="touch-feedback"
            >
              INSTALL
            </button>
            <button
              style={dismissButtonStyle}
              onClick={handleDismissInstall}
              className="touch-feedback"
            >
              LATER
            </button>
          </div>
        )}

        {/* --- TACTICAL NAVBAR --- */}
        <nav style={navStyle}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Link
              to="/"
              style={linkStyle}
              className="touch-feedback"
              onClick={() => isMobileDevice && vibrate([30])}
            >
              [ FEED ]
            </Link>
            <Link
              to="/profile"
              style={linkStyle}
              className="touch-feedback"
              onClick={() => isMobileDevice && vibrate([30])}
            >
              [ PROFILE ]
            </Link>
          </div>

          {user ? (
            <button
              onClick={logout}
              style={authButtonStyle}
              className="touch-feedback"
            >
              LOGOUT_{user.displayName?.toUpperCase()}
            </button>
          ) : (
            <button
              onClick={login}
              style={authButtonStyle}
              className="touch-feedback"
            >
              INITIALIZE_AUTH
            </button>
          )}
        </nav>

        {/* --- ROUTING ENGINE --- */}
        <main style={{ padding: '0', flex: 1, position: 'relative' }}>
          <Routes>
            <Route path="/" element={
              user ? (
                <Feed user={user} isOnline={isOnline} isMobile={isMobileDevice} />
              ) : (
                <div style={msgStyle}>ACCESS DENIED: PLEASE AUTHENTICATE</div>
              )
            } />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;