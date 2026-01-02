
import React, { useState, useEffect } from 'react';
import { whatsappService, QRCodeResponse, ConnectionState } from '../lib/whatsappService';
import Button from './Button';
import InputWithIcon from './InputWithIcon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface WhatsAppWizardProps {
    onConnected: () => void;
}

const WhatsAppWizard: React.FC<WhatsAppWizardProps> = ({ onConnected }) => {
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [instanceName, setInstanceName] = useState('');
    const [loading, setLoading] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<'open' | 'connecting' | 'close'>('close');

    // Polling for connection state in Step 2
    useEffect(() => {
        let interval: any;
        if (step === 2 && instanceName) {
            interval = setInterval(async () => {
                try {
                    const state = await whatsappService.getConnectionState(instanceName);
                    if (state?.instance.state === 'open') {
                        // Save connected status
                        if (user) {
                            await supabase.from('whatsapp_instances')
                                .update({ status: 'connected' })
                                .eq('user_id', user.id)
                                .eq('instance_name', instanceName);
                        }

                        setConnectionState('open');
                        setStep(3);
                        onConnected();
                        clearInterval(interval);
                    }
                } catch (err) {
                    console.error('Polling error:', err);
                }
            }, 5000);
        }
        return () => clearInterval(interval);
    }, [step, instanceName, onConnected, user]);

    const handleCreateInstance = async () => {
        if (!/^[a-zA-Z0-9]+$/.test(instanceName)) {
            setError('O nome da instância deve ser apenas alfanumérico.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            // 1. Create instance in Evolution API via Proxy
            await whatsappService.createInstance(instanceName);

            // 2. Save mapping in Supabase
            if (user) {
                await supabase.from('whatsapp_instances').upsert({
                    user_id: user.id,
                    instance_name: instanceName,
                    status: 'connecting'
                });
            }

            // 3. Get QR Code
            const qrResponse = await whatsappService.connectInstance(instanceName);
            console.log('QR Response:', qrResponse);

            // Tratar diferentes formatos de resposta da Evolution API
            let qrCodeData = null;
            if (qrResponse?.qrcode?.base64) {
                qrCodeData = qrResponse.qrcode.base64;
            } else if (qrResponse?.base64) {
                qrCodeData = qrResponse.base64;
            } else if (qrResponse?.code) {
                qrCodeData = qrResponse.code;
            } else if (typeof qrResponse === 'string') {
                qrCodeData = qrResponse;
            }

            if (qrCodeData) {
                // Garantir que é uma URL de data válida
                if (!qrCodeData.startsWith('data:')) {
                    qrCodeData = `data:image/png;base64,${qrCodeData}`;
                }
                setQrCode(qrCodeData);
                setStep(2);
            } else {
                console.error('QR Response format:', JSON.stringify(qrResponse));
                setError('Não foi possível gerar o código QR. Formato inesperado.');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao criar instância.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteInstance = async () => {
        if (!window.confirm('Tem certeza que deseja remover esta conexão?')) return;

        setLoading(true);
        try {
            await whatsappService.deleteInstance(instanceName);
            if (user) {
                await supabase.from('whatsapp_instances').delete().eq('user_id', user.id);
            }
            setStep(1);
            setInstanceName('');
            setQrCode(null);
            onConnected(); // Refresh parent state
        } catch (err) {
            console.error('Error deleting instance:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-border-dark rounded-2xl p-6 transition-all shadow-lg max-w-2xl mx-auto">
            {/* Steps Indicator */}
            <div className="flex items-center justify-between mb-8 px-4">
                {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center">
                        <div className={`size-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= s ? 'bg-primary text-background-dark' : 'bg-gray-100 dark:bg-background-dark text-gray-400'
                            }`}>
                            {s}
                        </div>
                        {s < 3 && (
                            <div className={`w-12 h-0.5 mx-2 ${step > s ? 'bg-primary' : 'bg-gray-100 dark:bg-background-dark'}`} />
                        )}
                    </div>
                ))}
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    {error}
                </div>
            )}

            {/* Step 1: Instance Name */}
            {step === 1 && (
                <div className="space-y-6 animate-fade-in">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Conectar WhatsApp</h3>
                        <p className="text-gray-500 dark:text-text-dim text-sm">Inicie definindo um nome único para sua instância de conexão.</p>
                    </div>

                    <div className="space-y-4">
                        <label className="block">
                            <span className="text-xs font-bold text-gray-500 dark:text-text-dim uppercase mb-2 block">Nome da Instância</span>
                            <InputWithIcon
                                icon="badge"
                                placeholder="ex: MinhaEmpresa01"
                                value={instanceName}
                                onChange={(e) => setInstanceName(e.target.value)}
                            />
                            <p className="text-[10px] text-gray-400 mt-1 italic">Dica: Use apenas letras e números, sem espaços ou símbolos.</p>
                        </label>

                        <Button
                            variant="primary"
                            className="w-full py-3"
                            onClick={handleCreateInstance}
                            disabled={loading || !instanceName}
                            icon={loading ? 'progress_activity' : 'arrow_forward'}
                        >
                            {loading ? 'Criando...' : 'Próximo'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Step 2: QR Code */}
            {step === 2 && (
                <div className="space-y-6 text-center animate-fade-in">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Escaneie o QR Code</h3>
                        <p className="text-gray-500 dark:text-text-dim text-sm">Abra o WhatsApp no seu celular {'>'} Aparelhos Conectados {'>'} Conectar um Aparelho.</p>
                    </div>

                    <div className="relative mx-auto size-64 bg-white p-4 rounded-2xl border border-gray-100 shadow-inner flex items-center justify-center">
                        {qrCode ? (
                            <img src={qrCode} alt="WhatsApp QR Code" className="size-full object-contain" />
                        ) : (
                            <div className="animate-pulse flex flex-col items-center">
                                <span className="material-symbols-outlined text-4xl text-gray-300">qr_code_2</span>
                                <p className="text-xs text-gray-400 mt-2">Gerando código...</p>
                            </div>
                        )}

                        {/* Status Overlay */}
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-background-dark text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                            <span className="material-symbols-outlined text-[14px]">sync</span>
                            Aguardando leitura...
                        </div>
                    </div>

                    <div className="pt-4 flex flex-col gap-3">
                        <p className="text-xs text-text-dim italic">O processo de conexão é automático após o escaneamento.</p>
                        <button
                            onClick={() => setStep(1)}
                            className="text-primary text-sm font-bold hover:underline"
                            disabled={loading}
                        >
                            Voltar e alterar nome
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Connected State (Based on user image) */}
            {step === 3 && (
                <div className="animate-fade-in">
                    <div className="bg-[#051c17] dark:bg-[#051c17] border border-emerald-500/20 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-8 flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <h1 className="text-2xl font-bold text-white tracking-tight">{instanceName}</h1>
                                <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                                    <span className="material-symbols-outlined text-white opacity-60">settings</span>
                                </button>
                            </div>

                            <div className="bg-[#0a2a22] rounded-xl p-4 flex items-center justify-between border border-emerald-500/10">
                                <p className="text-xs font-mono text-emerald-100/40 tracking-widest break-all">
                                    ****************_****_****_*...
                                </p>
                                <div className="flex gap-2">
                                    <span className="material-symbols-outlined text-emerald-400 text-[18px] cursor-pointer hover:text-white transition-colors">content_copy</span>
                                    <span className="material-symbols-outlined text-emerald-400 text-[18px] cursor-pointer hover:text-white transition-colors">visibility</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 py-2">
                                <div className="size-16 rounded-full bg-cover bg-center border-2 border-emerald-500/30" style={{ backgroundImage: 'url(https://i.pravatar.cc/150?u=organatu)' }}>
                                    <div className="size-full rounded-full bg-black/20 flex items-center justify-center">
                                        <span className="text-[10px] font-black text-white px-1 bg-black/40 rounded italic uppercase">Tetra Campeão</span>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-white">{instanceName}</h3>
                                    <p className="text-emerald-400/80 font-bold mb-1">Online</p>
                                    <p className="text-xs text-white/40 font-mono tracking-widest">5521994555858</p>
                                </div>
                                <div className="flex gap-6">
                                    <div className="text-center">
                                        <span className="material-symbols-outlined text-emerald-400/60 block mb-1">person_outline</span>
                                        <p className="text-white font-bold text-sm">1.473</p>
                                    </div>
                                    <div className="text-center">
                                        <span className="material-symbols-outlined text-emerald-400/60 block mb-1">chat_bubble_outline</span>
                                        <p className="text-white font-bold text-sm">83.232</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4">
                                <div className="bg-emerald-500/20 text-emerald-400 px-6 py-2 rounded-full font-black text-sm uppercase tracking-wider border border-emerald-500/30">
                                    Connected
                                </div>
                                <Button
                                    variant="danger"
                                    className="bg-red-900/40 hover:bg-red-800/60 border border-red-500/30 text-red-100 hover:text-white px-8 font-black uppercase tracking-wider"
                                    onClick={handleDeleteInstance}
                                    disabled={loading}
                                >
                                    Delete
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-emerald-500 text-sm font-bold flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined">check_circle</span>
                            Instância conectada e pronta para uso!
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WhatsAppWizard;
