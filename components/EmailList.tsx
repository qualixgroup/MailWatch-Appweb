import React, { useEffect, useState } from 'react';
import { gmailService, GmailMessage, GmailConnection } from '../lib/gmailService';
import { ruleEngine } from '../lib/ruleEngine';
import EmailViewer from './EmailViewer';
import { realtimeService } from '../lib/realtimeService';
import { supabase } from '../lib/supabase';

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
    const [currentPage, setCurrentPage] = useState(1);
    const [pageToken, setPageToken] = useState<string | null>(null);
    const [pageTokens, setPageTokens] = useState<string[]>(['']); // Store tokens for each page
    const [processingRules, setProcessingRules] = useState(false);
    const [rulesResult, setRulesResult] = useState<{ matched: number; message: string } | null>(null);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

    const handleDeleteEmail = async (emailId: string) => {
        if (!window.confirm('Tem certeza que deseja mover este email para a lixeira?')) return;

        // Optimistic update
        setEmails(prev => prev.filter(e => e.id !== emailId));
        setStats(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
        setActiveMenuId(null);

        try {
            await gmailService.trashEmail(emailId);
        } catch (error) {
            console.error('Failed to delete email:', error);
            // Could revert here if needed, but for trash usually safe to ignore or just log
            checkConnectionAndLoadEmails(); // Refresh to be sure
        }
    };

    useEffect(() => {
        checkConnectionAndLoadEmails();
    }, []);

    // Subscribe to broadcast channel for new email notifications from webhook
    useEffect(() => {
        let cleanup: (() => void) | null = null;

        const setup = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Listen for new-email broadcast from gmail-webhook
            const channel = supabase
                .channel(`new-email-${user.id}`)
                .on('broadcast', { event: 'new-email' }, (payload) => {
                    console.log('📨 [EmailList] New email notification received!', payload);
                    checkConnectionAndLoadEmails();
                })
                .subscribe();

            cleanup = () => {
                supabase.removeChannel(channel);
            };
        };

        setup();

        return () => {
            cleanup?.();
        };
    }, []);

    // Subscribe to realtime updates for new processed emails
    useEffect(() => {
        let cleanup: (() => void) | null = null;

        const setup = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Subscribe to processed_emails inserts to auto-refresh inbox
            const channel = supabase
                .channel('emaillist-processed')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'processed_emails',
                        filter: `user_id=eq.${user.id}`
                    },
                    (payload) => {
                        console.log('📧 [EmailList] New processed email, refreshing inbox', payload);
                        checkConnectionAndLoadEmails();
                    }
                )
                .subscribe();

            cleanup = () => {
                supabase.removeChannel(channel);
            };
        };

        setup();

        return () => {
            cleanup?.();
        };
    }, []);

    const checkConnectionAndLoadEmails = async (token?: string) => {
        setLoading(true);
        setError(null);

        try {
            const status = await gmailService.getConnectionStatus();
            setConnection(status);

            if (status.connected) {
                const [result, emailStats] = await Promise.all([
                    gmailService.fetchEmailsWithPagination(maxEmails, token),
                    gmailService.getEmailStats()
                ]);
                setEmails(result.emails);
                setPageToken(result.nextPageToken || null);
                setStats(emailStats);
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar emails');
        } finally {
            setLoading(false);
        }
    };

    const handleNextPage = async () => {
        if (!pageToken) return;

        // Store current page token for going back
        const newPageTokens = [...pageTokens];
        if (!newPageTokens[currentPage]) {
            newPageTokens[currentPage] = pageToken;
        }
        setPageTokens(newPageTokens);

        setCurrentPage(prev => prev + 1);
        await checkConnectionAndLoadEmails(pageToken);
    };

    const handlePrevPage = async () => {
        if (currentPage <= 1) return;

        const prevPage = currentPage - 1;
        const token = prevPage === 1 ? undefined : pageTokens[prevPage - 1];

        setCurrentPage(prevPage);
        await checkConnectionAndLoadEmails(token);
    };

    const handleFirstPage = async () => {
        if (currentPage <= 1) return;

        setCurrentPage(1);
        setPageTokens(['']);
        await checkConnectionAndLoadEmails(undefined);
    };

    const handleLastPage = async () => {
        // Note: Gmail API doesn't support jumping to last page directly
        // We'll navigate forward page by page until we reach the end
        // For now, this acts as a "skip ahead" by going 5 pages forward
        if (!pageToken) return;

        let currentToken = pageToken;
        let pagesSkipped = 0;
        const maxSkip = 5;

        while (currentToken && pagesSkipped < maxSkip) {
            const newPageTokens = [...pageTokens];
            newPageTokens[currentPage + pagesSkipped] = currentToken;
            setPageTokens(newPageTokens);

            try {
                const result = await gmailService.fetchEmailsWithPagination(maxEmails, currentToken);
                if (result.nextPageToken) {
                    currentToken = result.nextPageToken;
                    pagesSkipped++;
                } else {
                    // Reached the last page
                    setCurrentPage(prev => prev + pagesSkipped);
                    setEmails(result.emails);
                    setPageToken(null);
                    return;
                }
            } catch {
                break;
            }
        }

        // If we didn't reach the end, just go to the last page we found
        setCurrentPage(prev => prev + pagesSkipped);
        await checkConnectionAndLoadEmails(currentToken);
    };

    const handleEmailClick = (emailId: string) => {
        setSelectedEmailId(emailId);
    };

    const handleCloseViewer = () => {
        setSelectedEmailId(null);
    };

    const handleMarkAsRead = () => {
        setEmails(emails.map(e =>
            e.id === selectedEmailId ? { ...e, isUnread: false } : e
        ));
        setStats(s => ({ ...s, unread: Math.max(0, s.unread - 1) }));
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const isToday = date.toDateString() === now.toDateString();
            const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

            const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            if (isToday) {
                return timeStr; // Shows "14:30"
            }
            if (isYesterday) {
                return `Ontem, ${timeStr}`;
            }
            // For older emails, show date and time
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + `, ${timeStr}`;
        } catch {
            return dateStr;
        }
    };

    const extractName = (fromStr: string) => {
        const match = fromStr.match(/^([^<]+)/);
        return match ? match[1].trim() : fromStr;
    };

    const handleApplyRules = async () => {
        setProcessingRules(true);
        setRulesResult(null);

        try {
            // Process ALL emails from today, not just visible ones
            const result = await ruleEngine.processAllTodayEmails();

            setRulesResult({
                matched: result.newlyProcessed,
                message: result.message
            });

            // Refresh emails to show updated state
            if (result.newlyProcessed > 0) {
                await checkConnectionAndLoadEmails();
            }

            // Clear message after 8 seconds (longer since it has more info)
            setTimeout(() => setRulesResult(null), 8000);
        } catch (err: any) {
            setRulesResult({
                matched: 0,
                message: `Erro: ${err.message || 'Falha ao processar regras'}`
            });
        } finally {
            setProcessingRules(false);
        }
    };

    // Calculate display range
    const startIndex = (currentPage - 1) * maxEmails + 1;
    const endIndex = Math.min(startIndex + emails.length - 1, stats.total);

    if (loading) {
        return (
            <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-border-dark rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <span className="material-symbols-outlined text-primary animate-spin">progress_activity</span>
                    <span className="text-gray-500 dark:text-text-dim">Carregando emails...</span>
                </div>
            </div>
        );
    }

    if (!connection.connected) {
        return (
            <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-border-dark rounded-2xl p-6">
                <div className="text-center py-8">
                    <span className="material-symbols-outlined text-5xl text-gray-400 dark:text-text-dim mb-4 block">mail_lock</span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Gmail não conectado</h3>
                    <p className="text-gray-500 dark:text-text-dim text-sm mb-4">
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
            <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-border-dark rounded-2xl p-6">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
                    <span className="material-symbols-outlined text-red-500">error</span>
                    <span className="text-red-500">{error}</span>
                </div>
                <button
                    onClick={() => checkConnectionAndLoadEmails()}
                    className="mt-4 px-4 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-all"
                >
                    Tentar novamente
                </button>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-border-dark rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-border-dark flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary">inbox</span>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Caixa de Entrada</h3>
                        {stats.unread > 0 && (
                            <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-bold rounded-full">
                                {stats.unread} não lidos
                            </span>
                        )}
                    </div>
                </div>

                {/* Rules Result Message */}
                {rulesResult && (
                    <div className={`px-4 py-2 text-sm flex items-center gap-2 ${rulesResult.matched > 0 ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                        }`}>
                        <span className="material-symbols-outlined text-[18px]">
                            {rulesResult.matched > 0 ? 'check_circle' : 'info'}
                        </span>
                        {rulesResult.message}
                    </div>
                )}

                {/* Email List */}
                <div className="divide-y divide-gray-200 dark:divide-border-dark max-h-[500px] overflow-y-auto">
                    {emails.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-text-dim">
                            <span className="material-symbols-outlined text-4xl mb-2 block">inbox</span>
                            Nenhum email encontrado
                        </div>
                    ) : (
                        emails.map((email) => (
                            <div
                                key={email.id}
                                onClick={() => handleEmailClick(email.id)}
                                className={`p-4 hover:bg-gray-50 dark:hover:bg-background-dark/50 transition-all cursor-pointer group relative ${email.isUnread ? 'bg-primary/5' : ''}`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`size-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${email.isUnread ? 'bg-primary' : 'bg-gray-200 dark:bg-surface-dark border border-gray-300 dark:border-border-dark text-gray-600 dark:text-white'}`}>
                                        {extractName(email.from).charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0 pr-8">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <p className={`truncate ${email.isUnread ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-text-dim'}`}>
                                                {extractName(email.from)}
                                            </p>
                                            <span className="text-xs text-gray-500 dark:text-text-dim whitespace-nowrap">
                                                {formatDate(email.date)}
                                            </span>
                                        </div>
                                        <p className={`truncate text-sm ${email.isUnread ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-text-dim'}`}>
                                            {email.subject || '(Sem assunto)'}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-text-dim truncate mt-1">
                                            {email.snippet}
                                        </p>
                                    </div>

                                    {/* Action Menu Trigger (Visible on hover or if menu open) */}
                                    <div className="absolute right-4 top-4" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => setActiveMenuId(activeMenuId === email.id ? null : email.id)}
                                            className={`p-1 rounded-full text-gray-500 dark:text-text-dim hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all ${activeMenuId === email.id ? 'opacity-100 bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white' : 'opacity-0 group-hover:opacity-100'}`}
                                        >
                                            <span className="material-symbols-outlined text-[20px]">more_vert</span>
                                        </button>

                                        {/* Dropdown Menu */}
                                        {activeMenuId === email.id && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setActiveMenuId(null)} />
                                                <div className="absolute right-0 top-8 w-32 bg-white dark:bg-surface-dark border border-gray-200 dark:border-border-dark rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in">
                                                    <button
                                                        onClick={() => handleDeleteEmail(email.id)}
                                                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                                        Excluir
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {email.isUnread && (
                                        <div className="size-2 rounded-full bg-primary flex-shrink-0 mt-2 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none group-hover:opacity-0 transition-opacity"></div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer with Pagination */}
                <div className="p-4 border-t border-gray-200 dark:border-border-dark bg-gray-50 dark:bg-background-dark/30 flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-text-dim">
                        Conectado como {connection.email}
                    </p>

                    {/* Pagination Controls */}
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 dark:text-text-dim">
                            {emails.length > 0 ? `${startIndex}-${endIndex}` : '0'} de {stats.total.toLocaleString()}
                        </span>
                        <div className="flex items-center gap-0.5">
                            {/* First Page */}
                            <button
                                onClick={handleFirstPage}
                                disabled={currentPage <= 1 || loading}
                                className={`p-1.5 rounded-lg transition-all ${currentPage <= 1
                                    ? 'text-text-dim/30 cursor-not-allowed'
                                    : 'text-text-dim hover:text-primary hover:bg-primary/10'
                                    }`}
                                title="Primeira página"
                            >
                                <span className="material-symbols-outlined text-[20px]">first_page</span>
                            </button>
                            {/* Previous Page */}
                            <button
                                onClick={handlePrevPage}
                                disabled={currentPage <= 1 || loading}
                                className={`p-1.5 rounded-lg transition-all ${currentPage <= 1
                                    ? 'text-text-dim/30 cursor-not-allowed'
                                    : 'text-text-dim hover:text-primary hover:bg-primary/10'
                                    }`}
                                title="Página anterior"
                            >
                                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                            </button>
                            {/* Next Page */}
                            <button
                                onClick={handleNextPage}
                                disabled={!pageToken || loading}
                                className={`p-1.5 rounded-lg transition-all ${!pageToken
                                    ? 'text-text-dim/30 cursor-not-allowed'
                                    : 'text-text-dim hover:text-primary hover:bg-primary/10'
                                    }`}
                                title="Próxima página"
                            >
                                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                            </button>
                            {/* Last Page */}
                            <button
                                onClick={handleLastPage}
                                disabled={!pageToken || loading}
                                className={`p-1.5 rounded-lg transition-all ${!pageToken
                                    ? 'text-text-dim/30 cursor-not-allowed'
                                    : 'text-text-dim hover:text-primary hover:bg-primary/10'
                                    }`}
                                title="Última página"
                            >
                                <span className="material-symbols-outlined text-[20px]">last_page</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Email Viewer Modal */}
            {selectedEmailId && (
                <EmailViewer
                    messageId={selectedEmailId}
                    onClose={handleCloseViewer}
                    onMarkAsRead={handleMarkAsRead}
                    onDelete={() => {
                        handleDeleteEmail(selectedEmailId);
                        handleCloseViewer();
                    }}
                />
            )}
        </>
    );
};

export default EmailList;
