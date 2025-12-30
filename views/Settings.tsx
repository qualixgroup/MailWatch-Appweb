
import React, { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import { UserProfile } from '../types';
import { profileService } from '../lib/profileService';
import { gmailService, GmailConnection } from '../lib/gmailService';
import { useAuth } from '../contexts/AuthContext';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [gmailConnection, setGmailConnection] = useState<GmailConnection>({ connected: false });
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [language, setLanguage] = useState('Português (Brasil)');
  const [timezone, setTimezone] = useState('(GMT-03:00) São Paulo');

  useEffect(() => {
    loadProfile();
    loadGmailStatus();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await profileService.getProfile();
      if (data) {
        setProfile(data);
        setFullName(data.fullName);
        setLanguage(data.language);
        setTimezone(data.timezone);
      }
    } catch (error) {
      console.error('Failed to load profile', error);
      setMessage({ type: 'error', text: 'Erro ao carregar perfil.' });
    } finally {
      setLoading(false);
    }
  };

  const loadGmailStatus = async () => {
    try {
      const status = await gmailService.getConnectionStatus();
      setGmailConnection(status);
    } catch (error) {
      console.error('Failed to load Gmail status', error);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setMessage(null);

    try {
      await profileService.updateProfile({
        fullName,
        language,
        timezone
      });
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
      // Reload to ensure sync
      loadProfile();
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar configurações.' });
    } finally {
      setSaving(false);
    }
  };

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    setMessage(null);

    try {
      const authUrl = await gmailService.initiateOAuth();
      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (error: any) {
      console.error('Failed to initiate OAuth', error);
      setMessage({ type: 'error', text: error.message || 'Erro ao iniciar conexão com Google.' });
      setConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    setConnectingGoogle(true);
    setMessage(null);

    try {
      const result = await gmailService.disconnect();
      if (result.success) {
        setGmailConnection({ connected: false });
        setMessage({ type: 'success', text: 'Gmail desconectado com sucesso!' });
        loadProfile();
      } else {
        setMessage({ type: 'error', text: result.error || 'Erro ao desconectar Gmail.' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Erro ao desconectar Gmail.' });
    } finally {
      setConnectingGoogle(false);
    }
  };

  const toggleSlackIntegration = async () => {
    if (!profile) return;
    try {
      await profileService.toggleIntegration('slack', profile);
      loadProfile();
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao atualizar integração.' });
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-text-dim">Carregando configurações...</div>;
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <PageHeader
        title="Configurações"
        description="Gerencie suas preferências, conta e integrações do MailWatch."
      />

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-48 flex-shrink-0">
          <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto">
            {['Geral', 'Conta', 'Integrações', 'Avançado'].map((tab, i) => (
              <button
                key={tab}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all whitespace-nowrap ${i === 0 ? 'bg-primary text-background-dark font-bold' : 'text-text-dim hover:bg-white/5 hover:text-white'}`}
              >
                <span className="material-symbols-outlined text-[20px]">{['settings', 'person', 'extension', 'tune'][i]}</span>
                {tab}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 space-y-8">
          <section className="bg-surface-dark border border-border-dark rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">person</span>
              Perfil do Usuário
            </h3>

            {message && (
              <div className={`mb-6 p-4 rounded-lg border flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                <span className="material-symbols-outlined text-[18px]">{message.type === 'success' ? 'check_circle' : 'error'}</span>
                {message.text}
              </div>
            )}

            <div className="space-y-6">
              <div className="flex items-center gap-6 pb-6 border-b border-border-dark">
                <div className="size-20 rounded-2xl bg-surface-dark border border-border-dark flex items-center justify-center text-primary bg-primary/10">
                  {profile?.avatarUrl ? (
                    <div className="size-full bg-cover bg-center rounded-2xl" style={{ backgroundImage: `url(${profile.avatarUrl})` }} />
                  ) : (
                    <span className="material-symbols-outlined text-4xl">person</span>
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-text-dim uppercase mb-1">Nome Completo</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-white focus:border-primary outline-none"
                      placeholder="Seu nome"
                    />
                  </div>
                  <p className="text-text-dim text-sm mt-1">{profile?.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-dim uppercase tracking-wider">Idioma</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none"
                  >
                    <option>Português (Brasil)</option>
                    <option>English (US)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-dim uppercase tracking-wider">Fuso Horário</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none"
                  >
                    <option>(GMT-03:00) São Paulo</option>
                    <option>(GMT+00:00) UTC</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-surface-dark border border-border-dark rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">hub</span>
              Integrações Conectadas
            </h3>
            <div className="space-y-4">
              {/* Google Workspace Integration */}
              <div className={`flex items-center justify-between p-4 bg-background-dark border rounded-xl transition-all ${gmailConnection.connected ? 'border-emerald-500/30' : 'border-border-dark'}`}>
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-lg bg-white p-1.5 flex items-center justify-center">
                    <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCs23Rh8t3UHr9Ur7Ql0jTlkOY4nvBphBD4v_u-92BK0gf6mGrjsfLmsGdR8oQIx4tRb9cQ1EigPp-TLg-m_N4U6n_hyDllk9z15574qE5fnbg-2QganLX2-vXJM12qytD1xxcjsOjocoFEjNo7yoOfHRJ7FZ9IqCRiq8LUZSmLb0T7_r86HVz-o7IYszQf5MS57ysdKkkk84DS93-5HQUnP35Rch7D_4wxaMB6VEAmOOWUu8epMa720mbtyOnzkayuElTFpbRRBC5M" alt="Gmail" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <p className="text-white font-bold">Google Workspace</p>
                    {gmailConnection.connected ? (
                      <div className="flex flex-col">
                        <p className="text-xs font-bold text-emerald-500">Sincronização Ativa</p>
                        <p className="text-xs text-text-dim">{gmailConnection.email}</p>
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-text-dim">Desconectado</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={gmailConnection.connected ? handleDisconnectGoogle : handleConnectGoogle}
                  disabled={connectingGoogle}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${gmailConnection.connected ? 'text-red-400 hover:bg-red-400/10' : 'text-primary hover:bg-primary/10'} ${connectingGoogle ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {connectingGoogle && (
                    <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                  )}
                  {gmailConnection.connected ? 'Desconectar' : 'Conectar'}
                </button>
              </div>

              {/* Slack Integration */}
              <div className={`flex items-center justify-between p-4 bg-background-dark border rounded-xl transition-all ${profile?.integrations.slack ? 'border-emerald-500/30' : 'border-border-dark opacity-60'}`}>
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-lg bg-surface-dark p-2 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white">chat</span>
                  </div>
                  <div>
                    <p className="text-white font-bold">Slack Notifications</p>
                    <p className={`text-xs font-bold ${profile?.integrations.slack ? 'text-emerald-500' : 'text-text-dim'}`}>
                      {profile?.integrations.slack ? 'Sincronização Ativa' : 'Desconectado'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleSlackIntegration}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${profile?.integrations.slack ? 'text-red-400 hover:bg-red-400/10' : 'text-primary hover:bg-primary/10'}`}
                >
                  {profile?.integrations.slack ? 'Desconectar' : 'Conectar'}
                </button>
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" className="px-6 py-2.5" onClick={loadProfile}>
              Cancelar
            </Button>
            <Button variant="primary" icon={saving ? 'progress_activity' : 'save'} className="px-8 py-2.5" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

