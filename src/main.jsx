import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './ErrorBoundary';
import './index.css';

/**
 * INITIALIZATION_PROTOCOL
 * Rendering the application within the Defensive Engineering stack.
 * Hierarchy: StrictMode -> ErrorBoundary -> App
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);