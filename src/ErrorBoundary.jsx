import React from 'react';
import { Button, SystemIcon } from './Library';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorLog: "" };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI.
    return { hasError: true, errorLog: error.toString() };
  }

  componentDidCatch(error, errorInfo) {
    // In a production app, you'd send this to a service like Sentry
    console.error("KERNEL_PANIC_LOG:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-8 font-sans">
          <div className="relative border border-red-900/30 bg-red-950/5 p-12 max-w-xl w-full overflow-hidden">
            {/* Background Decorative Element */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-red-600/5 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 text-center">
              <SystemIcon name="AlertOctagon" size={48} className="text-red-600 mx-auto mb-6" glow />
              
              <h2 className="text-white font-black uppercase tracking-tighter text-3xl mb-2">
                Kernel_Panic
              </h2>
              
              <div className="flex items-center justify-center gap-2 mb-8">
                <div className="h-[1px] w-12 bg-red-900/50"></div>
                <span className="text-red-500 font-mono text-[10px] uppercase tracking-[0.2em]">
                  Runtime_Exception_Detected
                </span>
                <div className="h-[1px] w-12 bg-red-900/50"></div>
              </div>

              <div className="bg-black/50 border border-red-900/20 p-4 mb-10 text-left">
                <p className="text-red-800 font-mono text-[10px] leading-relaxed break-all">
                  {this.state.errorLog}
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  onClick={() => window.location.reload()}
                  icon="RefreshCw"
                >
                  Reboot_Node
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => this.setState({ hasError: false })}
                >
                  Attempt_Recovery
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;