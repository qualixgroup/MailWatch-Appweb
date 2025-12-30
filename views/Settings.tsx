import React, { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import { UserProfile } from '../types';
import { profileService } from '../lib/profileService';
import { gmailService, GmailConnection } from '../lib/gmailService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [gmailConnection, setGmailConnection] = useState<GmailConnection>({ connected: false });
  const { settings, updateSettings } = useSettings();

  // Tab State
  const [activeTab, setActiveTab] = useState('Geral');

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
      loadProfile();
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar configurações.' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
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
            {['Geral', 'Conta', 'Integrações', 'Avançado'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all whitespace-nowrap ${activeTab === tab
                  ? 'bg-primary text-background-dark font-bold'
                  : 'text-text-dim hover:bg-white/5 hover:text-white'
                  }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {tab === 'Geral' && 'tune'}
                  {tab === 'Conta' && 'person'}
                  {tab === 'Integrações' && 'hub'}
                  {tab === 'Avançado' && 'settings'}
                </span>
                {tab}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 flex flex-col gap-8">
          {message && (
            <div className={`p-4 rounded-lg border flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
              <span className="material-symbols-outlined text-[18px]">{message.type === 'success' ? 'check_circle' : 'error'}</span>
              {message.text}
            </div>
          )}

          {/* Tab: Conta - Profile Section */}
          {activeTab === 'Conta' && (
            <section className="bg-surface-dark border border-border-dark rounded-2xl p-6 animate-fade-in">
              <h3 className="text-lg font-bold mb-6 text-white flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">person</span>
                Perfil do Usuário
              </h3>

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
                      <option>(GMT-05:00) New York</option>
                      <option>(GMT+00:00) London</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button variant="primary" icon={saving ? 'progress_activity' : 'save'} className="px-8 py-2.5" onClick={handleSave} disabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </div>
              </div>
            </section>
          )}

          {/* Tab: Geral - Preferences Section */}
          {activeTab === 'Geral' && (
            <section className="bg-surface-dark border border-border-dark rounded-2xl p-6 animate-fade-in">
              <h3 className="text-lg font-bold mb-6 text-white flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">tune</span>
                Preferências do Sistema
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-medium text-text-dim mb-2">
                    Intervalo de Monitoramento Automático
                  </label>
                  <div className="flex flex-col gap-2">
                    <select
                      value={settings.checkInterval}
                      onChange={(e) => updateSettings({ checkInterval: Number(e.target.value) })}
                      className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value={30000}>30 segundos (Rápido)</option>
                      <option value={60000}>1 minuto (Padrão)</option>
                      <option value={300000}>5 minutos</option>
                      <option value={900000}>15 minutos</option>
                      <option value={3600000}>1 hora</option>
                    </select>
                    <p className="text-xs text-text-dim/60">
                      Define a frequência com que o sistema verifica novos emails.
                      Intervalos menores consomem mais quota da API do Gmail.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-background-dark/50 rounded-lg border border-border-dark/50">
                    <div>
                      <p className="font-medium text-white">Sons de Notificação</p>
                      <p className="text-xs text-text-dim">Tocar som ao aplicar regras</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.enableSounds}
                        onChange={(e) => updateSettings({ enableSounds: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-surface-lighter rounded-full peer peer-focus:ring-2 peer-focus:ring-primary/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-background-dark/50 rounded-lg border border-border-dark/50">
                    <div>
                      <p className="font-medium text-white">Notificações Visuais</p>
                      <p className="text-xs text-text-dim">Exibir popups de status</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.enableToasts}
                        onChange={(e) => updateSettings({ enableToasts: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-surface-lighter rounded-full peer peer-focus:ring-2 peer-focus:ring-primary/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Tab: Integrações - Connected Integrations */}
          {activeTab === 'Integrações' && (
            <section className="bg-surface-dark border border-border-dark rounded-2xl p-6 animate-fade-in">
              <h3 className="text-lg font-bold mb-6 text-white flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">hub</span>
                Integrações Conectadas
              </h3>

              <div className="space-y-4">
                {/* Google Integration */}
                <div className={`flex items-center justify-between p-4 bg-background-dark border rounded-xl transition-all ${gmailConnection.connected ? 'border-emerald-500/30' : 'border-border-dark'}`}>
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-lg bg-white p-1.5 flex items-center justify-center">
                      <svg className="w-6 h-6" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
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
                  {gmailConnection.connected ? (
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 text-xs font-bold rounded-lg text-red-400 hover:bg-red-400/10 transition-all"
                    >
                      Desconectar
                    </button>
                  ) : (
                    <a
                      href="/login"
                      className="px-4 py-2 text-xs font-bold rounded-lg text-primary hover:bg-primary/10 transition-all"
                    >
                      Conectar com Google
                    </a>
                  )}
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
          )}

          {/* Tab: Avançado */}
          {activeTab === 'Avançado' && (
            <div className="flex flex-col items-center justify-center h-64 text-text-dim animate-fade-in">
              <span className="material-symbols-outlined text-4xl mb-4 opacity-50">construction</span>
              <p>Configurações avançadas em breve.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
