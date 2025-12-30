import React, { useEffect, useState } from 'react';
import { gmailService, GmailMessage, GmailConnection } from '../lib/gmailService';
import EmailViewer from './EmailViewer';

interface EmailListProps {
    maxEmails?: number;
}

const EmailList: React.FC<EmailListProps> = ({ maxEmails = 10 }) => {
    const [emails, setEmails] = useState<GmailMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connection, setConnection] = useState<GmailConnection>({ connected: false });
    const [stats, setStats] = useState<{ total: number; unread: number }>({ total: 0, unread: 0 });
    const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

    useEffect(() => {
        checkConnectionAndLoadEmails();
    }, []);

    const checkConnectionAndLoadEmails = async () => {
        setLoading(true);
        setError(null);

        try {
            const status = await gmailService.getConnectionStatus();
            setConnection(status);

            if (status.connected) {
                const [fetchedEmails, emailStats] = await Promise.all([
                    gmailService.fetchEmails(maxEmails),
                    gmailService.getEmailStats()
                ]);
                setEmails(fetchedEmails);
                setStats(emailStats);
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar emails');
        } finally {
            setLoading(false);
        }
    };

    const handleEmailClick = (emailId: string) => {
        setSelectedEmailId(emailId);
    };

    const handleCloseViewer = () => {
        setSelectedEmailId(null);
    };

    const handleMarkAsRead = () => {
        // Update the local state to mark email as read
        setEmails(emails.map(e =>
            e.id === selectedEmailId ? { ...e, isUnread: false } : e
        ));
        // Update unread count
        setStats(s => ({ ...s, unread: Math.max(0, s.unread - 1) }));
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diff = now.getTime() - date.getTime();
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const days = Math.floor(hours / 24);

            if (hours < 1) return 'Agora';
            if (hours < 24) return `${hours}h atrás`;
            if (days < 7) return `${days}d atrás`;
            return date.toLocaleDateString('pt-BR');
        } catch {
            return dateStr;
        }
    };

    const extractName = (fromStr: string) => {
        const match = fromStr.match(/^([^<]+)/);
        return match ? match[1].trim() : fromStr;
    };

    if (loading) {
        return (
            <div className="bg-surface-dark border border-border-dark rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <span className="material-symbols-outlined text-primary animate-spin">progress_activity</span>
                    <span className="text-text-dim">Carregando emails...</span>
                </div>
            </div>
        );
    }

    if (!connection.connected) {
        return (
            <div className="bg-surface-dark border border-border-dark rounded-2xl p-6">
                <div className="text-center py-8">
                    <span className="material-symbols-outlined text-5xl text-text-dim mb-4 block">mail_lock</span>
                    <h3 className="text-lg font-bold text-white mb-2">Gmail não conectado</h3>
                    <p className="text-text-dim text-sm mb-4">
                        Faça login com sua conta Google para visualizar seus emails.
                    </p>
                    <a
                        href="/login"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-background-dark rounded-lg font-bold hover:bg-primary/90 transition-all"
                    >
                        <span className="material-symbols-outlined text-[18px]">login</span>
                        Conectar Gmail
                    </a>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-surface-dark border border-border-dark rounded-2xl p-6">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
                    <span className="material-symbols-outlined text-red-500">error</span>
                    <span className="text-red-500">{error}</span>
                </div>
                <button
                    onClick={checkConnectionAndLoadEmails}
                    className="mt-4 px-4 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-all"
                >
                    Tentar novamente
                </button>
            </div>
        );
    }

    return (
        <>
            <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-border-dark flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary">inbox</span>
                        <h3 className="text-lg font-bold text-white">Caixa de Entrada</h3>
                        {stats.unread > 0 && (
                            <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-bold rounded-full">
                                {stats.unread} não lidos
                            </span>
                        )}
                    </div>
                    <button
                        onClick={checkConnectionAndLoadEmails}
                        className="p-2 text-text-dim hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                        title="Atualizar"
                    >
                        <span className="material-symbols-outlined text-[20px]">refresh</span>
                    </button>
                </div>

                {/* Email List */}
                <div className="divide-y divide-border-dark max-h-[500px] overflow-y-auto">
                    {emails.length === 0 ? (
                        <div className="p-8 text-center text-text-dim">
                            <span className="material-symbols-outlined text-4xl mb-2 block">inbox</span>
                            Nenhum email encontrado
                        </div>
                    ) : (
                        emails.map((email) => (
                            <div
                                key={email.id}
                                onClick={() => handleEmailClick(email.id)}
                                className={`p-4 hover:bg-background-dark/50 transition-all cursor-pointer ${email.isUnread ? 'bg-primary/5' : ''}`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`size-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${email.isUnread ? 'bg-primary' : 'bg-surface-dark border border-border-dark'}`}>
                                        {extractName(email.from).charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <p className={`truncate ${email.isUnread ? 'font-bold text-white' : 'text-text-dim'}`}>
                                                {extractName(email.from)}
                                            </p>
                                            <span className="text-xs text-text-dim whitespace-nowrap">
                                                {formatDate(email.date)}
                                            </span>
                                        </div>
                                        <p className={`truncate text-sm ${email.isUnread ? 'font-semibold text-white' : 'text-text-dim'}`}>
                                            {email.subject || '(Sem assunto)'}
                                        </p>
                                        <p className="text-xs text-text-dim truncate mt-1">
                                            {email.snippet}
                                        </p>
                                    </div>
                                    {email.isUnread && (
                                        <div className="size-2 rounded-full bg-primary flex-shrink-0 mt-2"></div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border-dark bg-background-dark/30">
                    <p className="text-xs text-text-dim text-center">
                        Mostrando {emails.length} de {stats.total.toLocaleString()} emails • Conectado como {connection.email}
                    </p>
                </div>
            </div>

            {/* Email Viewer Modal */}
            {selectedEmailId && (
                <EmailViewer
                    messageId={selectedEmailId}
                    onClose={handleCloseViewer}
                    onMarkAsRead={handleMarkAsRead}
                />
            )}
        </>
    );
};

export default EmailList;
