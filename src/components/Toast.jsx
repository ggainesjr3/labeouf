import React, { useEffect } from 'react';
import { SystemIcon } from './Library';

/**
 * COMPONENT: Toast
 * A persistent notification system for security events and database commits.
 */
const Toast = ({ message, type = 'error', onClose }) => {
  useEffect(() => {
    // Standard 4-second dwell time for readability
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  // Industrial color mapping
  const styles = {
    error: {
      border: "border-red-900/50",
      text: "text-red-500",
      bg: "bg-red-950/20",
      icon: "AlertTriangle",
      label: "Critical_Error"
    },
    success: {
      border: "border-emerald-900/50",
      text: "text-emerald-500",
      bg: "bg-emerald-950/20",
      icon: "ShieldCheck",
      label: "System_Success"
    },
    warning: {
      border: "border-orange-900/50",
      text: "text-orange-500",
      bg: "bg-orange-950/20",
      icon: "Activity",
      label: "Node_Warning"
    }
  };

  const current = styles[type] || styles.error;

  return (
    <div 
      className={`
        fixed bottom-8 left-8 flex items-center gap-4 border p-4 backdrop-blur-md 
        animate-in fade-in slide-in-from-left-6 duration-300 z-[100]
        ${current.border} ${current.bg}
      `}
    >
      {/* Decorative Corner Accents */}
      <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-white/20"></div>
      <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-white/20"></div>

      <div className={`${current.text} drop-shadow-[0_0_5px_currentColor]`}>
        <SystemIcon name={current.icon} size={20} />
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className={`text-[8px] font-black uppercase tracking-[0.3em] ${current.text}`}>
            {current.label}
          </span>
          <div className="h-[1px] w-8 bg-white/10"></div>
        </div>
        <p className="text-[11px] font-mono lowercase tracking-tight text-zinc-300 mt-1">
          {message}
        </p>
      </div>

      <button 
        onClick={onClose}
        className="ml-4 text-zinc-600 hover:text-white transition-colors"
      >
        <SystemIcon name="X" size={14} />
      </button>
    </div>
  );
};

export default Toast;