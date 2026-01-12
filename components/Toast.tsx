import React, { createContext, useContext, useState, useCallback } from 'react';

interface Toast {
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message?: string;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = Date.now().toString();
        const newToast = { ...toast, id };

        setToasts(prev => [...prev, newToast]);

        // Auto-remove after duration (default 5s)
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, toast.duration || 5000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
};

const ToastContainer: React.FC<{ toasts: Toast[]; onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
    if (toasts.length === 0) return null;

    const getIcon = (type: Toast['type']) => {
        switch (type) {
            case 'success': return 'check_circle';
            case 'error': return 'error';
            case 'warning': return 'warning';
            case 'info': return 'info';
        }
    };

    const getColors = (type: Toast['type']) => {
        switch (type) {
            case 'success': return 'bg-green-50 border-green-200 text-green-700 dark:bg-green-500/20 dark:border-green-500/30 dark:text-green-400';
            case 'error': return 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/20 dark:border-red-500/30 dark:text-red-400';
            case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-500/20 dark:border-yellow-500/30 dark:text-yellow-400';
            case 'info': return 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/20 dark:border-blue-500/30 dark:text-blue-400';
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm shadow-lg animate-slide-in bg-white/90 dark:bg-surface-dark/90 ${getColors(toast.type)}`}
                >
                    <span className="material-symbols-outlined text-[20px] mt-0.5">{getIcon(toast.type)}</span>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 dark:text-white text-sm">{toast.title}</p>
                        {toast.message && (
                            <p className="text-xs opacity-80 mt-0.5 text-gray-700 dark:text-text-dim">{toast.message}</p>
                        )}
                    </div>
                    <button
                        onClick={() => onRemove(toast.id)}
                        className="text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>
            ))}
        </div>
    );
};

// Global toast function for use outside React components
let globalAddToast: ((toast: Omit<Toast, 'id'>) => void) | null = null;

export const setGlobalToast = (addToast: (toast: Omit<Toast, 'id'>) => void) => {
    globalAddToast = addToast;
};

export const showToast = (toast: Omit<Toast, 'id'>) => {
    if (globalAddToast) {
        globalAddToast(toast);
    } else {
        console.log('[Toast]', toast.title, toast.message);
    }
};
