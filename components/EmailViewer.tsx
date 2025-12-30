import React, { useEffect, useState } from 'react';
import { gmailService, GmailFullMessage } from '../lib/gmailService';

interface EmailViewerProps {
    messageId: string;
    onClose: () => void;
    onMarkAsRead?: () => void;
}

const EmailViewer: React.FC<EmailViewerProps> = ({ messageId, onClose, onMarkAsRead }) => {
    const [email, setEmail] = useState<GmailFullMessage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        loadEmail();
    }, [messageId]);

    const loadEmail = async () => {
        setLoading(true);
        setError(null);

        try {
            const fullEmail = await gmailService.getFullEmail(messageId);
            if (fullEmail) {
                setEmail(fullEmail);

                // Auto-mark as read when opened
                if (fullEmail.isUnread) {
                    await gmailService.markAsRead(messageId);
                    onMarkAsRead?.();
                }
            } else {
                setError('Não foi possível carregar o email');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar email');
        } finally {
            setLoading(false);
        }
    };

    const handleArchive = async () => {
        setActionLoading('archive');
        const success = await gmailService.archiveEmail(messageId);
        setActionLoading(null);
        if (success) {
            onClose();
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    };

    const extractName = (fromStr: string) => {
        const match = fromStr.match(/^([^<]+)/);
        return match ? match[1].trim() : fromStr;
    };

    const extractEmail = (fromStr: string) => {
        const match = fromStr.match(/<([^>]+)>/);
        return match ? match[1] : fromStr;
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-surface-dark border border-border-dark rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-border-dark flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white truncate flex-1 mr-4">
                        {loading ? 'Carregando...' : email?.subject || '(Sem assunto)'}
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleArchive}
                            disabled={loading || !!actionLoading}
                            className="p-2 text-text-dim hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-50"
                            title="Arquivar"
                        >
                            {actionLoading === 'archive' ? (
                                <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined text-[20px]">archive</span>
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-text-dim hover:text-white hover:bg-white/10 rounded-lg transition-all"
                            title="Fechar"
                        >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-8 flex items-center justify-center gap-3">
                            <span className="material-symbols-outlined text-primary animate-spin">progress_activity</span>
                            <span className="text-text-dim">Carregando email...</span>
                        </div>
                    ) : error ? (
                        <div className="p-8 text-center">
                            <span className="material-symbols-outlined text-red-500 text-4xl mb-4 block">error</span>
                            <p className="text-red-500">{error}</p>
                            <button
                                onClick={loadEmail}
                                className="mt-4 px-4 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg"
                            >
                                Tentar novamente
                            </button>
                        </div>
                    ) : email ? (
                        <div>
                            {/* Email Header */}
                            <div className="p-4 bg-background-dark/50 border-b border-border-dark space-y-3">
                                <div className="flex items-start gap-4">
                                    <div className="size-12 rounded-full bg-primary/20 text-primary flex items-center justify-center text-lg font-bold flex-shrink-0">
                                        {extractName(email.from).charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-white">{extractName(email.from)}</p>
                                        <p className="text-sm text-text-dim">{extractEmail(email.from)}</p>
                                        <p className="text-xs text-text-dim mt-1">
                                            Para: {email.to}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-text-dim">{formatDate(email.date)}</p>
                                    </div>
                                </div>

                                {/* Attachments */}
                                {email.attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-3 border-t border-border-dark">
                                        {email.attachments.map((att, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-2 px-3 py-2 bg-surface-dark border border-border-dark rounded-lg text-sm"
                                            >
                                                <span className="material-symbols-outlined text-[16px] text-text-dim">attach_file</span>
                                                <span className="text-white">{att.filename}</span>
                                                <span className="text-text-dim text-xs">({formatSize(att.size)})</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Email Body */}
                            <div className="p-6">
                                {email.htmlBody ? (
                                    <div
                                        className="prose prose-invert max-w-none email-content"
                                        dangerouslySetInnerHTML={{ __html: email.htmlBody }}
                                    />
                                ) : (
                                    <pre className="text-white whitespace-pre-wrap font-sans text-sm leading-relaxed">
                                        {email.body}
                                    </pre>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border-dark bg-background-dark/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            className="flex items-center gap-2 px-3 py-2 text-sm text-text-dim hover:text-white hover:bg-white/10 rounded-lg transition-all"
                        >
                            <span className="material-symbols-outlined text-[18px]">reply</span>
                            Responder
                        </button>
                        <button
                            className="flex items-center gap-2 px-3 py-2 text-sm text-text-dim hover:text-white hover:bg-white/10 rounded-lg transition-all"
                        >
                            <span className="material-symbols-outlined text-[18px]">forward</span>
                            Encaminhar
                        </button>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-all"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmailViewer;
