
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rule, RuleStatus } from '../types';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import StatusBadge from '../components/StatusBadge';
import InputWithIcon from '../components/InputWithIcon';

interface RulesProps {
  rules: Rule[];
  onToggleRule: (id: string) => void;
  onDeleteRule: (id: string) => void;
}

const Rules: React.FC<RulesProps> = ({ rules, onToggleRule, onDeleteRule }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRules = rules.filter(rule =>
    rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.subjectFilter.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-border-dark pb-6">
        <div className="flex flex-col gap-2 max-w-2xl">
          <h2 className="text-3xl font-bold text-white tracking-tight">Regras de Monitoramento</h2>
          <p className="text-text-dim text-base">Gerencie suas automações, filtros de assunto e alertas de e-mail em tempo real.</p>
        </div>
        <Button
          variant="primary"
          icon="add"
          onClick={() => navigate('/rules/new')}
          className="px-6 py-3 shadow-lg shadow-primary/25 active:scale-95"
        >
          Criar Nova Regra
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-surface-dark p-4 rounded-xl border border-border-dark shadow-lg">
        <div className="flex-1 w-full">
          <InputWithIcon
            icon="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar regra por nome, assunto..."
            className="bg-background-dark"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-text-dim whitespace-nowrap">
          <span>Exibindo</span>
          <span className="font-bold text-white">{filteredRules.length}</span>
          <span>regras</span>
        </div>
      </div>

      <div className="w-full overflow-hidden rounded-xl border border-border-dark bg-surface-dark shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background-dark/50 border-b border-border-dark text-text-dim">
                <th className="p-4 text-xs font-bold uppercase tracking-wider">Regra</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider">Filtro / Condição</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider">Notificação</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dark">
              {filteredRules.map((rule) => (
                <tr key={rule.id} className="group hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${rule.status === RuleStatus.ACTIVE ? 'bg-primary/10 text-primary' : 'bg-gray-500/10 text-gray-500'}`}>
                        <span className="material-symbols-outlined text-[20px]">{rule.icon || 'receipt_long'}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{rule.name}</p>
                        <p className="text-[10px] text-text-dim">Criada em {rule.createdAt}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="inline-flex w-fit items-center px-2 py-0.5 rounded bg-background-dark border border-border-dark text-[10px] font-mono text-text-dim">
                        "{rule.subjectFilter}"
                      </span>
                      <span className="text-xs text-white opacity-80">{rule.condition}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-1 text-xs text-text-dim">
                        <span className="material-symbols-outlined text-[14px]">mail</span>
                        {(rule.notificationEmails || []).map((email, i) => (
                          <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                            {email}
                          </span>
                        ))}
                        {(!rule.notificationEmails || rule.notificationEmails.length === 0) && (
                          <span className="text-text-dim">Nenhum</span>
                        )}
                      </div>
                      {rule.whatsappNumbers && rule.whatsappNumbers.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 text-xs text-emerald-400 font-medium">
                          <span className="material-symbols-outlined text-[14px]">chat</span>
                          {rule.whatsappNumbers.map((number, i) => (
                            <span key={i} className="px-2 py-0.5 bg-emerald-500/10 rounded-full text-xs">
                              {number}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <StatusBadge
                      status={rule.status === RuleStatus.ACTIVE ? 'active' : 'paused'}
                      label={rule.status}
                      size="sm"
                    />
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => navigate(`/rules/edit/${rule.id}`)}
                        className="p-2 rounded-lg hover:bg-white/10 text-text-dim hover:text-white transition-colors" title="Editar"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        onClick={() => onToggleRule(rule.id)}
                        className={`p-2 rounded-lg hover:bg-white/10 transition-colors ${rule.status === RuleStatus.ACTIVE ? 'text-text-dim hover:text-yellow-400' : 'text-text-dim hover:text-emerald-400'}`}
                        title={rule.status === RuleStatus.ACTIVE ? "Pausar" : "Retomar"}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {rule.status === RuleStatus.ACTIVE ? 'pause' : 'play_arrow'}
                        </span>
                      </button>
                      <button
                        onClick={() => onDeleteRule(rule.id)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-text-dim hover:text-red-500 transition-colors" title="Excluir"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Rules;
