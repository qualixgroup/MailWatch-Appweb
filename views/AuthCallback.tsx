import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { gmailService } from '../lib/gmailService';

const AuthCallback: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [message, setMessage] = useState('Conectando sua conta Gmail...');
    const [email, setEmail] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            const code = searchParams.get('code');
            const state = searchParams.get('state');
            const error = searchParams.get('error');

            if (error) {
                setStatus('error');
                setMessage(`Erro: ${error}`);
                setTimeout(() => navigate('/settings'), 3000);
                return;
            }

            if (!code || !state) {
                setStatus('error');
                setMessage('Parâmetros inválidos');
                setTimeout(() => navigate('/settings'), 3000);
                return;
            }

            try {
                const result = await gmailService.handleCallback(code, state);

                if (result.success) {
                    setStatus('success');
                    setEmail(result.email || null);
                    setMessage('Gmail conectado com sucesso!');
                } else {
                    setStatus('error');
                    setMessage(result.error || 'Erro ao conectar Gmail');
                }
            } catch (err) {
                setStatus('error');
                setMessage('Erro ao processar autenticação');
            }

            // Redirect to settings after 2 seconds
            setTimeout(() => navigate('/settings'), 2000);
        };

        handleCallback();
    }, [searchParams, navigate]);

    return (
        <div className="min-h-screen bg-background-dark flex items-center justify-center">
            <div className="bg-surface-dark border border-border-dark rounded-2xl p-8 max-w-md w-full mx-4 text-center">
                {status === 'processing' && (
                    <>
                        <div className="animate-spin size-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                        <h2 className="text-xl font-bold text-white mb-2">Processando...</h2>
                        <p className="text-text-dim">{message}</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="size-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-4xl text-emerald-500">check_circle</span>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Sucesso!</h2>
                        <p className="text-text-dim">{message}</p>
                        {email && (
                            <p className="text-primary mt-2 font-medium">{email}</p>
                        )}
                        <p className="text-text-dim text-sm mt-4">Redirecionando para configurações...</p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="size-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-4xl text-red-500">error</span>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Erro</h2>
                        <p className="text-text-dim">{message}</p>
                        <p className="text-text-dim text-sm mt-4">Redirecionando para configurações...</p>
                    </>
                )}
            </div>
        </div>
    );
};

export default AuthCallback;
