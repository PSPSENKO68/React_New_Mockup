import { useEffect, useState } from 'react';

export default function DebugInfo() {
  const [logs, setLogs] = useState<string[]>([]);
  
  useEffect(() => {
    // Store original console methods
    const originalConsoleError = console.error;
    
    // Override console.error
    console.error = function(...args) {
      // Call the original method
      originalConsoleError.apply(console, args);
      
      // Format and store the log
      const timestamp = new Date().toISOString();
      const formattedArgs = args.map(arg => {
        if (arg instanceof Error) {
          return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
        } else if (typeof arg === 'object') {
          try {
            if (arg && arg.message) {
              // Handle GHN API error specifically
              if (arg.message.includes('GHN API Error')) {
                return `GHN API Error: ${JSON.stringify(arg, null, 2)}`;
              }
            }
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        } else {
          return String(arg);
        }
      });
      
      const logMessage = `${timestamp} \n ${formattedArgs.join(' ')}`;
      setLogs(prevLogs => [...prevLogs, logMessage].slice(-10)); // Keep only the last 10 logs
    };
    
    // Cleanup function to restore original methods
    return () => {
      console.error = originalConsoleError;
    };
  }, []);
  
  // Only show in development
  if (import.meta.env.MODE !== 'development') {
    return null;
  }
  
  return (
    <div className="debug-info">
      <details>
        <summary className="text-xs text-red-500 cursor-pointer">Debug Info (Click to expand)</summary>
        <div className="text-xs whitespace-pre-wrap bg-gray-100 p-2 max-h-96 overflow-auto">
          {logs.length === 0 ? (
            <p>No errors logged.</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-2 pb-2 border-b border-gray-300">
                {log}
              </div>
            ))
          )}
        </div>
      </details>
    </div>
  );
} 