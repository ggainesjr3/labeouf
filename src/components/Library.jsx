import React from 'react';
import * as Icons from 'lucide-react';

/** * UI_CORE: Standardized Icons & Indicators
 */
export const SystemIcon = ({ name, size = 18, className = "", glow = false }) => {
  const IconComponent = Icons[name];
  if (!IconComponent) return <Icons.AlertCircle size={size} className="text-red-900 opacity-50" />;
  return <IconComponent size={size} className={`${glow ? 'drop-shadow-[0_0_8px_rgba(234,88,12,0.6)]' : ''} ${className}`.trim()} />;
};

export const StatusIndicator = ({ status = 'online' }) => {
  const themes = {
    online: "bg-emerald-500 shadow-[0_0_8px_#10b981]",
    syncing: "bg-orange-500 animate-pulse shadow-[0_0_8px_#f97316]",
    offline: "bg-red-600 shadow-[0_0_8px_#dc2626]"
  };
  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-zinc-950 border border-zinc-900 rounded-full">
      <div className={`w-1 h-1 rounded-full ${themes[status] || themes.offline}`} />
      <span className="text-[8px] font-mono uppercase text-zinc-500">Node_{status}</span>
    </div>
  );
};

/** * DATA_VISUALIZATION: ML & Network Metrics
 */
export const Sparkline = ({ data = [20, 50, 30, 80, 40, 90, 60], color = "#ea580c" }) => {
  const points = data.map((val, i) => `${i * (120 / (data.length - 1))},${100 - val}`).join(' ');
  return (
    <div className="h-6 w-24 opacity-60">
      <svg viewBox="0 0 120 100" className="w-full h-full overflow-visible">
        <polyline fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" points={points} />
      </svg>
    </div>
  );
};

export const InferenceLog = ({ label, confidence, latency }) => (
  <div className="flex items-center justify-between font-mono text-[9px] py-2 border-b border-zinc-900/30">
    <div className="flex items-center gap-2">
      <span className="text-zinc-700">PROB_</span>
      <span className="text-white uppercase font-black">{label}</span>
    </div>
    <div className="flex items-center gap-3">
      <span className="text-zinc-800 italic">{latency}ms</span>
      <span className={`${confidence > 0.85 ? 'text-emerald-500' : 'text-orange-500'} font-black`}>{(confidence * 100).toFixed(1)}%</span>
    </div>
  </div>
);

/** * INFRASTRUCTURE: Health & Persistence
 */
export const HealthNode = ({ service, status, latency }) => (
  <div className="flex items-center justify-between p-3 bg-black border border-zinc-900 mb-2 active:bg-zinc-800">
    <div className="flex items-center gap-3">
      <div className={`w-1 h-1 ${status === 'operational' ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
      <span className="text-[9px] font-mono text-zinc-400 uppercase">{service}</span>
    </div>
    <span className="text-[8px] font-mono text-zinc-800">{latency}ms</span>
  </div>
);

export const PersistenceIndicator = ({ isSyncing }) => (
  <div className={`flex items-center gap-2 transition-opacity duration-500 ${isSyncing ? 'opacity-100' : 'opacity-0'}`}>
    <Icons.Save size={10} className="text-orange-500" />
    <span className="text-[8px] font-mono text-orange-500 uppercase">Disk_Sync</span>
  </div>
);

/** * INTERFACE: Buttons, Inputs, Cards
 */
export const SearchInput = ({ value, onChange }) => (
  <div className="relative flex items-center mb-4">
    <Icons.Search size={14} className="absolute left-3 text-zinc-700" />
    <input 
      type="text" value={value} onChange={onChange} placeholder="FILTER_STREAM..." 
      className="w-full bg-zinc-950 border border-zinc-900 py-3 pl-10 pr-4 text-[10px] font-mono text-zinc-300 uppercase outline-none focus:border-orange-500 transition-all appearance-none"
    />
  </div>
);

export const SignalCard = ({ sender, message, timestamp }) => (
  <div className="bg-zinc-950/40 border-l-2 border-orange-600 p-4 mb-3 active:bg-zinc-900">
    <div className="flex justify-between items-start mb-1">
      <span className="text-[10px] font-black text-orange-500 uppercase">{sender}</span>
      <span className="text-[8px] font-mono text-zinc-700">{timestamp}</span>
    </div>
    <p className="text-xs text-zinc-300 font-mono lowercase">{message}</p>
  </div>
);

export const AuditRow = ({ timestamp, action, status = 'info' }) => {
  const colors = { info: 'text-zinc-600', success: 'text-emerald-600', error: 'text-red-600' };
  return (
    <div className="flex gap-2 font-mono text-[9px] py-1 opacity-70">
      <span className="text-zinc-800">[{timestamp}]</span>
      <span className={`uppercase font-black ${colors[status]}`}>{status}</span>
      <span className="text-zinc-400 truncate">{action}</span>
    </div>
  );
};

export const Card = ({ title, subtitle, children }) => (
  <div className="bg-zinc-900/20 border border-zinc-900 p-5 rounded-sm relative overflow-hidden">
    <div className="mb-4">
      <h3 className="text-white font-black text-xs uppercase tracking-tight">{title}</h3>
      {subtitle && <p className="text-[8px] text-zinc-600 font-mono uppercase mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </div>
);

export const Button = ({ children, icon, ...props }) => (
  <button className="flex items-center justify-center gap-2 px-5 py-3 bg-orange-600 text-black text-[10px] font-black uppercase active:bg-orange-500" {...props}>
    {icon && <SystemIcon name={icon} size={14} />} {children}
  </button>
);