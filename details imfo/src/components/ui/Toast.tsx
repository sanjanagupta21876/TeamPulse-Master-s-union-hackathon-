import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, AlertCircle } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'info' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  description?: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, description?: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, description?: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, description, type }]);

    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      {/* Toast container */}
      <div 
        role="region" 
        aria-label="Notifications" 
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-[#18181B] border border-[#27272A] shadow-xl text-sm animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <div className="mt-0.5 shrink-0">
              {item.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {item.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
              {item.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
              {item.type === 'info' && <Info className="w-4 h-4 text-purple-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[#FAFAFA] leading-tight">{item.message}</p>
              {item.description && (
                <p className="mt-1 text-xs text-[#A1A1AA] leading-relaxed">{item.description}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(item.id)}
              className="text-[#A1A1AA] hover:text-[#FAFAFA] p-0.5 rounded transition-colors"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
