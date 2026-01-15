
import React from 'react';
import { ActivityLog } from '../types';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { realtimeService } from '../lib/realtimeService';

interface LogsProps {
  logs: ActivityLog[];
  onRefresh?: () => void;
}

const Logs: React.FC<LogsProps> = ({ logs, onRefresh }) => {
  const [isRealtimeConnected, setIsRealtimeConnected] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = realtimeService.onConnectionChange(setIsRealtimeConnected);
    return () => unsubscribe();
  }, []);

  const stats = [
    { label: 'Total Hoje', value: '1,248', icon: 'analytics', color: 'text-blue-400' },
    { label: 'Sucesso', value: '98%', icon: 'check_circle', color: 'text-emerald-400' },
    { label: 'Erros', value: '12', icon: 'error', color: 'text-red-400' },
    { label: 'Processamento', value: '0.4s', icon: 'timer', color: 'text-purple-400' },
  ];

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <PageHeader
        title="Logs de Atividade"
        description="Monitore, audite e exporte o histórico completo de ações do sistema."
      >
        {isRealtimeConnected && (
          <span className="flex items-center gap-1.5 text-emerald-500 text-xs font-medium px-2 py-1 bg-emerald-500/10 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live
          </span>
        )}
        <Button variant="secondary" icon="download">
          Exportar CSV
        </Button>
        <Button variant="primary" icon="refresh" onClick={onRefresh}>
          Atualizar
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-gray-200 dark:border-border-dark shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-text-dim">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{s.value}</p>
              </div>
              <div className={`p-2 bg-gray-100 dark:bg-white/5 rounded-lg ${s.color}`}>
                <span className="material-symbols-outlined">{s.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-border-dark rounded-xl shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-background-dark/50 border-b border-gray-200 dark:border-border-dark text-gray-500 dark:text-text-dim uppercase text-[10px] font-bold tracking-widest">
              <tr>
                <th className="px-6 py-4">Data / Hora</th>
                <th className="px-6 py-4">Evento</th>
                <th className="px-6 py-4">Descrição</th>
                <th className="px-6 py-4 text-right">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-border-dark">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-text-dim font-mono text-xs">
                    {log.timestamp}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge
                      status={log.status === 'success' ? 'success' : log.status === 'error' ? 'error' : 'info'}
                      label={log.type}
                      withDot={false}
                      size="sm"
                    />
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                    {log.title}
                    <p className="text-xs text-gray-500 dark:text-text-dim font-normal mt-0.5">{log.description}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {log.details ? (
                      <span className="text-red-400 font-bold bg-red-400/10 px-2 py-0.5 rounded text-[10px] uppercase">{log.details}</span>
                    ) : (
                      <button className="text-gray-500 dark:text-text-dim hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[18px]">more_vert</span>
                      </button>
                    )}
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

export default Logs;
