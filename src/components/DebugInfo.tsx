import { useEffect, useState } from 'react';

export function DebugInfo() {
  const [errorInfo, setErrorInfo] = useState<string[]>([]);
  
  useEffect(() => {
    // Store original console.error
    const originalError = console.error;
    
    // Override console.error to capture errors
    console.error = (...args) => {
      originalError(...args);
      setErrorInfo(prev => [...prev, args.join(' ')]);
    };
    
    // Restore original on cleanup
    return () => {
      console.error = originalError;
    };
  }, []);
  
  if (errorInfo.length === 0) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md max-h-80 overflow-auto">
      <h3 className="text-red-600 font-semibold mb-2">Debug Information</h3>
      <ul className="text-xs space-y-1">
        {errorInfo.map((error, index) => (
          <li key={index} className="text-red-500">{error}</li>
        ))}
      </ul>
      <button 
        className="mt-2 text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
        onClick={() => setErrorInfo([])}
      >
        Clear
      </button>
    </div>
  );
} 