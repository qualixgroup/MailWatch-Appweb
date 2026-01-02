import React from 'react';
import WhatsAppWizard from '../components/WhatsAppWizard';

const WhatsAppConnect: React.FC = () => {
    const handleConnected = () => {
        // Notify parent window if available
        if (window.opener) {
            // Send message to parent to reload profile/status
            window.opener.postMessage('whatsapp-connected', '*');

            // Optional: Close window after delay?
            // setTimeout(() => window.close(), 3000);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-background-dark flex items-center justify-center p-4 transition-colors">
            <div className="w-full max-w-lg bg-white dark:bg-surface-dark rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-border-dark animate-fade-in">
                <div className="p-6 bg-primary/10 border-b border-primary/10 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">chat</span>
                        Conectar WhatsApp
                    </h1>
                </div>
                <div className="p-6">
                    <WhatsAppWizard onConnected={handleConnected} />
                </div>
            </div>
        </div>
    );
};

export default WhatsAppConnect;
