import React, { useEffect, useState } from 'react';
import { emailMonitor } from '../lib/emailMonitor';

interface MonitorState {
    isRunning: boolean;
    lastCheck: Date | null;
    processedCount: number;
    errors: string[];
}

const EmailMonitorStatus: React.FC = () => {
    const [state, setState] = useState<MonitorState>(emailMonitor.getState());
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        // Subscribe to monitor state changes
        const unsubscribe = emailMonitor.subscribe(setState);

        // Auto-start monitor when component mounts
        emailMonitor.start(60000); // Check every 60 seconds

        return () => {
            unsubscribe();
            // Don't stop monitor on unmount - let it run in background
        };
    }, []);

    const formatLastCheck = () => {
        if (!state.lastCheck) return 'Nunca';

        const now = new Date();
        const diff = now.getTime() - new Date(state.lastCheck).getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);

        if (seconds < 60) return `${seconds}s atrás`;
        if (minutes < 60) return `${minutes}min atrás`;
        return new Date(state.lastCheck).toLocaleTimeString('pt-BR');
    };

    const handleToggle = () => {
        if (state.isRunning) {
            emailMonitor.stop();
        } else {
            emailMonitor.start();
        }
    };

    const handleManualCheck = async () => {
        await emailMonitor.checkAndProcess();
    };

    return (
        <div className="bg-surface-dark border border-border-dark rounded-2xl p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`size-10 rounded-xl flex items-center justify-center ${state.isRunning
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                        <span className="material-symbols-outlined">
                            {state.isRunning ? 'sensors' : 'sensors_off'}
                        </span>
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm">Monitoramento Automático</h3>
                        <p className="text-xs text-text-dim">
                            {state.isRunning
                                ? `Ativo • Última verificação: ${formatLastCheck()}`
                                : 'Pausado'
                            }
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleManualCheck}
                        disabled={!state.isRunning}
                        className="p-2 text-text-dim hover:text-primary hover:bg-primary/10 rounded-lg transition-all disabled:opacity-50"
                        title="Verificar agora"
                    >
                        <span className="material-symbols-outlined text-[20px]">refresh</span>
                    </button>
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="p-2 text-text-dim hover:text-white hover:bg-white/10 rounded-lg transition-all"
                        title="Detalhes"
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            {showDetails ? 'expand_less' : 'expand_more'}
                        </span>
                    </button>
                    <button
                        onClick={handleToggle}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${state.isRunning
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            }`}
                    >
                        {state.isRunning ? 'Pausar' : 'Iniciar'}
                    </button>
                </div>
            </div>

            {/* Details Panel */}
            {showDetails && (
                <div className="mt-4 pt-4 border-t border-border-dark space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-text-dim">Emails processados</p>
                            <p className="text-white font-bold">{state.processedCount}</p>
                        </div>
                        <div>
                            <p className="text-text-dim">Intervalo</p>
                            <p className="text-white font-bold">60 segundos</p>
                        </div>
                    </div>

                    {state.errors.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                            <p className="text-xs text-red-400 font-medium mb-1">Erros recentes:</p>
                            {state.errors.slice(-3).map((error, i) => (
                                <p key={i} className="text-xs text-red-400/80">{error}</p>
                            ))}
                        </div>
                    )}

                    <p className="text-xs text-text-dim">
                        O monitoramento verifica automaticamente novos emails e aplica as regras ativas.
                        Apenas emails não processados anteriormente serão verificados.
                    </p>
                </div>
            )}
        </div>
    );
};

export default EmailMonitorStatus;
