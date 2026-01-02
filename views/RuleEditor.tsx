import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Rule, RuleStatus, RuleCondition } from '../types';
import Button from '../components/Button';
import InputWithIcon from '../components/InputWithIcon';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import WhatsAppWizard from '../components/WhatsAppWizard';

interface RuleEditorProps {
  rules?: Rule[];
  onSave: (rule: any) => void;
  onDelete?: (id: string) => void;
}

const RuleEditor: React.FC<RuleEditorProps> = ({ rules, onSave, onDelete }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!id;

  const [connectedInstance, setConnectedInstance] = useState<string | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    subjectFilter: '',
    condition: RuleCondition.CONTAINS,
    notificationEmail: '',
    whatsappNumber: '',
    status: RuleStatus.ACTIVE,
    icon: 'receipt_long'
  });

  useEffect(() => {
    if (isEditing && rules) {
      const existing = rules.find(r => r.id === id);
      if (existing) {
        setFormData({
          name: existing.name,
          subjectFilter: existing.subjectFilter,
          condition: existing.condition,
          notificationEmail: existing.notificationEmail,
          whatsappNumber: existing.whatsappNumber || '',
          status: existing.status,
          icon: existing.icon || 'receipt_long'
        });
      }
    }
  }, [id, rules, isEditing]);

  useEffect(() => {
    loadWhatsappStatus();
  }, [user]);

  const loadWhatsappStatus = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('whatsapp_instances')
        .select('instance_name, status')
        .eq('user_id', user.id)
        .eq('status', 'connected')
        .maybeSingle(); // Use maybeSingle to avoid errors if no row exists

      if (data) {
        setConnectedInstance(data.instance_name);
      } else {
        setConnectedInstance(null);
      }
    } catch (error) {
      console.error('Error loading whatsapp status:', error);
      setConnectedInstance(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      onSave({ ...formData, id, createdAt: rules?.find(r => r.id === id)?.createdAt });
    } else {
      onSave(formData);
    }
    navigate('/rules');
  };

  const handleDelete = () => {
    if (id && onDelete) {
      onDelete(id);
      navigate('/rules');
    }
  };

  return (
    <div className="flex flex-col items-center py-4 animate-fade-in relative">
      <div className="w-full max-w-3xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-text-dim text-sm mb-2">
              <span className="hover:text-white cursor-pointer transition-colors" onClick={() => navigate('/rules')}>Regras</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              <span className="text-white">{isEditing ? 'Editar Regra' : 'Criar Nova Regra'}</span>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">{isEditing ? 'Editar Regra' : 'Nova Regra'}</h1>
            {/* ID hidden as requested */}
          </div>
          {isEditing && (
            <Button
              variant="danger"
              icon="delete"
              onClick={handleDelete}
            >
              Excluir Regra
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-dark border border-border-dark rounded-xl overflow-hidden shadow-2xl">
          <div className="h-1 w-full bg-gradient-to-r from-teal-900 via-primary to-teal-900 opacity-50"></div>
          <div className="p-6 md:p-8 space-y-8">
            {/* Section: Geral */}
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-border-dark/50">
                <span className="material-symbols-outlined text-primary">tune</span>
                Configurações Gerais
              </h2>
              <div className="grid grid-cols-1 gap-6">
                <label className="flex flex-col w-full">
                  <p className="text-white text-sm font-medium mb-2">Nome da Regra</p>
                  <InputWithIcon
                    icon="label"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Alertas de Pagamento"
                    hint="Identificador interno para esta automação."
                  />
                </label>
              </div>
            </div>

            {/* Section: Lógica */}
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-border-dark/50">
                <span className="material-symbols-outlined text-primary">filter_alt</span>
                Lógica de Filtragem
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <label className="flex flex-col w-full md:col-span-1">
                  <p className="text-white text-sm font-medium mb-2">Condição</p>
                  <select
                    value={formData.condition}
                    onChange={e => setFormData({ ...formData, condition: e.target.value as RuleCondition })}
                    className="w-full rounded-lg bg-background-dark/50 border border-border-dark text-white focus:border-primary focus:ring-1 focus:ring-primary px-3 py-3 transition-all outline-none cursor-pointer"
                  >
                    {Object.values(RuleCondition).map(cond => (
                      <option key={cond} value={cond}>{cond}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col w-full md:col-span-2">
                  <p className="text-white text-sm font-medium mb-2">Filtro de Assunto</p>
                  <InputWithIcon
                    icon="search"
                    required
                    value={formData.subjectFilter}
                    onChange={e => setFormData({ ...formData, subjectFilter: e.target.value })}
                    placeholder="Ex: [IMPORTANTE]"
                  />
                </label>
              </div>
            </div>

            {/* Section: Ações */}
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-border-dark/50">
                <span className="material-symbols-outlined text-primary">notifications_active</span>
                Ações e Status
              </h2>
              <div className="grid grid-cols-1 gap-6">
                <label className="flex flex-col w-full">
                  <p className="text-white text-sm font-medium mb-2">E-mail de Notificação</p>
                  <InputWithIcon
                    icon="mail"
                    required
                    type="email"
                    value={formData.notificationEmail}
                    onChange={e => setFormData({ ...formData, notificationEmail: e.target.value })}
                    placeholder="alerta@empresa.com"
                  />
                </label>

                {/* WhatsApp Logic */}
                <div className="flex flex-col gap-4 p-4 rounded-xl border border-border-dark bg-background-dark/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <span className="material-symbols-outlined text-green-500">chat</span>
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">Notificação via WhatsApp</p>
                        <p className="text-xs text-text-dim">
                          {connectedInstance
                            ? `Enviado por: ${connectedInstance} (Conectado)`
                            : 'Nenhum WhatsApp conectado para envio.'}
                        </p>
                      </div>
                    </div>
                    {!connectedInstance && (
                      <Button
                        type="button"
                        variant="primary"
                        className="text-xs px-3 py-1.5"
                        onClick={() => setIsWizardOpen(true)}
                      >
                        Conectar WhatsApp
                      </Button>
                    )}
                    {connectedInstance && (
                      <span className="text-emerald-500 text-xs font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        Pronto para envio
                      </span>
                    )}
                  </div>

                  <label className="flex flex-col w-full">
                    <p className="text-white text-sm font-medium mb-2">Número de Destino (Para quem enviar?)</p>
                    <InputWithIcon
                      icon="person"
                      type="tel"
                      value={formData.whatsappNumber || ''}
                      onChange={e => setFormData({ ...formData, whatsappNumber: e.target.value })}
                      placeholder="5521999999999"
                      hint="Digite o número que RECEBERÁ a notificação (com DDD)."
                      disabled={!connectedInstance}
                    />
                    {!connectedInstance && (
                      <p className="text-xs text-yellow-500 mt-1">
                        ⚠️ Conecte um WhatsApp para habilitar este campo.
                      </p>
                    )}
                  </label>
                </div>

                <div className="flex flex-col pt-2">
                  <p className="text-white text-sm font-medium mb-2">Status da Regra</p>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-background-dark/50 border border-border-dark">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary">play_circle</span>
                      <span className="text-white font-medium text-sm">Monitoramento Ativo</span>
                    </div>
                    <label className="relative flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={formData.status === RuleStatus.ACTIVE}
                        onChange={() => setFormData({ ...formData, status: formData.status === RuleStatus.ACTIVE ? RuleStatus.PAUSED : RuleStatus.ACTIVE })}
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 md:px-8 bg-background-dark/30 border-t border-border-dark flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate('/rules')}
              className="w-full sm:w-auto px-6 py-3"
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              icon="save"
              className="w-full sm:w-auto px-8 py-3"
            >
              Salvar Regra
            </Button>
          </div>
        </form>
      </div>

      {/* WhatsApp Wizard Modal (Reused) */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setIsWizardOpen(false)}>
          <div className="bg-white dark:bg-surface-dark w-full max-w-lg rounded-2xl shadow-2xl relative overflow-hidden border border-gray-100 dark:border-border-dark" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setIsWizardOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors z-10"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="p-1">
              <WhatsAppWizard onConnected={() => {
                setIsWizardOpen(false);
                loadWhatsappStatus(); // Refresh status here
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RuleEditor;
