import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("SYSTEM_CRITICAL_FAILURE:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={errorContainer}>
          <div style={terminalHeader}>ERROR_LOG_v1.0.4</div>
          <h1 style={massiveTextStyle}>[!] SYSTEM_HALT</h1>
          <p style={subTextStyle}>UNRECOVERABLE_ERROR_IN_DATA_STREAM</p>
          <div style={codeBox}>
            STATUS_CODE: 0x505_UI_CRASH
            <br />
            LOCATION: {window.location.pathname.toUpperCase()}
          </div>
          <button onClick={() => window.location.reload()} style={retryButton}>
            INITIALIZE_SYSTEM_REBOOT
          </button>
        </div>
      );
    }
    return this.props.children; 
  }
}

const errorContainer = { backgroundColor: '#900', color: '#fff', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace', padding: '20px', textAlign: 'center', boxSizing: 'border-box' };
const terminalHeader = { position: 'absolute', top: 0, left: 0, padding: '10px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' };
const massiveTextStyle = { fontSize: '4rem', margin: '0', letterSpacing: '-3px', fontWeight: '900' };
const subTextStyle = { fontSize: '1rem', marginTop: '10px', letterSpacing: '2px' };
const codeBox = { border: '1px solid #fff', padding: '15px', margin: '30px 0', fontSize: '0.9rem', backgroundColor: 'rgba(0,0,0,0.2)' };
const retryButton = { backgroundColor: '#fff', color: '#900', border: 'none', padding: '15px 30px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', fontFamily: 'monospace', boxShadow: '5px 5px 0px #000' };

export default ErrorBoundary;
