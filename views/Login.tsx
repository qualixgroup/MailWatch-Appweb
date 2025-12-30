
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
import InputWithIcon from '../components/InputWithIcon';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSignUp, setIsSignUp] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                setMessage('Verifique seu e-mail para confirmar o cadastro!');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                navigate('/dashboard');
            }
        } catch (err: any) {
            setError(err.message || 'Ocorreu um erro.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background-dark p-4">
            <div className="w-full max-w-md bg-surface-dark border border-border-dark rounded-2xl shadow-2xl p-8 relative overflow-hidden">
                {/* Decorative background gradients */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                <div className="relative z-10 flex flex-col items-center mb-8">
                    <div className="flex items-center justify-center size-14 rounded-xl bg-primary/20 text-primary shadow-lg shadow-primary/10 mb-4">
                        <span className="material-symbols-outlined text-3xl font-bold">mark_email_read</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">MailWatch</h1>
                    <p className="text-text-dim text-sm">Automação Inteligente de E-mails</p>
                </div>

                <form onSubmit={handleAuth} className="space-y-6 relative z-10">
                    <div className="space-y-4">
                        <InputWithIcon
                            icon="mail"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            className="bg-background-dark/80"
                        />
                        <InputWithIcon
                            icon="lock"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Sua senha"
                            className="bg-background-dark/80"
                        />
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">error</span>
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            {message}
                        </div>
                    )}

                    <Button
                        variant="primary"
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 text-base shadow-xl"
                        icon={loading ? 'progress_activity' : isSignUp ? 'person_add' : 'login'}
                    >
                        {loading ? 'Processando...' : isSignUp ? 'Criar Conta' : 'Entrar na Plataforma'}
                    </Button>

                    <div className="pt-4 border-t border-border-dark text-center">
                        <button
                            type="button"
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setError(null);
                                setMessage(null);
                            }}
                            className="text-sm text-text-dim hover:text-primary transition-colors font-medium"
                        >
                            {isSignUp ? 'Já tem uma conta? Faça login' : 'Não tem conta? Cadastre-se grátis'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
