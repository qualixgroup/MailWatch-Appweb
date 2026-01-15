
import React from 'react';
import { Link } from 'react-router-dom';
import { Rule, ActivityLog, RuleStatus } from '../types';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import EmailList from '../components/EmailList';
import { realtimeService } from '../lib/realtimeService';

interface DashboardProps {
  rules: Rule[];
  logs: ActivityLog[];
  onToggleRule: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ rules, logs, onToggleRule }) => {
  const [isRealtimeConnected, setIsRealtimeConnected] = React.useState(false);

  // Subscribe to realtime connection status
  React.useEffect(() => {
    const unsubscribe = realtimeService.onConnectionChange(setIsRealtimeConnected);
    return () => unsubscribe();
  }, []);

  const activeRulesCount = rules.filter(r => r.status === RuleStatus.ACTIVE).length;
  const pausedRulesCount = rules.length - activeRulesCount;

  // Calculate stats from logs (today)
  const today = new Date().toDateString();
  const todayLogs = logs.filter(log => {
    try {
      return new Date(log.created_at || log.timestamp).toDateString() === today;
    } catch {
      return false;
    }
  });
  const matchedToday = todayLogs.filter(log => log.type === 'RuleMatch').length;
  const processedToday = todayLogs.length;


  const stats = [
    {
      label: 'Emails Processados',
      value: processedToday.toLocaleString(),
      sub: `${matchedToday} ações hoje`,
      change: '+100%',
      icon: 'mail',
      color: 'text-primary'
    },
    {
      label: 'Regras Ativas',
      value: activeRulesCount.toString(),
      sub: `${pausedRulesCount} pausadas`,
      icon: 'rule',
      color: 'text-blue-400'
    },
    {
      label: 'Ações Executadas',
      value: matchedToday.toString(),
      sub: 'Desde 00:00',
      icon: 'bolt',
      color: 'text-purple-400'
    }
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Live Status Indicator */}
      {isRealtimeConnected && (
        <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium animate-pulse">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          Atualizações em tempo real ativas
        </div>
      )}

      {/* Stats Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <StatCard
            key={i}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
            sub={stat.sub}
            change={stat.change}
          />
        ))}
      </section>

      {/* Email Inbox */}
      <section>
        <EmailList maxEmails={10} />
      </section>

      {/* Rules Table Snippet */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Regras Principais</h3>
          <Link to="/rules" className="text-primary hover:text-primary-dark text-sm font-medium transition-colors">Ver todas</Link>
        </div>
        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-surface-lighter/30 border-b border-gray-200 dark:border-border-dark text-gray-500 dark:text-text-dim">
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider">Regra</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-border-dark">
                {rules.slice(0, 3).map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`size-8 rounded-lg flex items-center justify-center ${rule.status === RuleStatus.ACTIVE ? 'bg-primary/10 text-primary' : 'bg-gray-500/10 text-gray-500'}`}>
                          <span className="material-symbols-outlined text-[18px]">{rule.icon || 'receipt_long'}</span>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">{rule.name}</p>
                          <p className="text-xs text-gray-500 dark:text-text-dim">{rule.subjectFilter}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge
                        status={rule.status === RuleStatus.ACTIVE ? 'active' : 'paused'}
                        label={rule.status}
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => onToggleRule(rule.id)}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md text-gray-500 dark:text-text-dim hover:text-gray-900 dark:hover:text-white transition-all"
                        title={rule.status === RuleStatus.ACTIVE ? "Pausar" : "Retomar"}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {rule.status === RuleStatus.ACTIVE ? 'pause_circle' : 'play_circle'}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Atividade Recente</h3>
          <Link to="/logs" className="text-primary hover:text-primary-dark text-sm font-medium">Ver Histórico</Link>
        </div>
        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-border-dark rounded-xl p-6 shadow-xl">
          <div className="relative pl-4 border-l border-gray-200 dark:border-border-dark space-y-8">
            {logs.slice(0, 3).map((log) => (
              <div key={log.id} className="relative">
                <div className="absolute -left-[21px] top-1 bg-white dark:bg-surface-dark rounded-full p-1 border border-gray-200 dark:border-border-dark">
                  <div className={`size-2 rounded-full ${log.status === 'success' ? 'bg-emerald-500' :
                    log.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                    }`}></div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{log.title}</p>
                  <span className="text-xs text-gray-500 dark:text-text-dim font-mono">{log.timestamp}</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-text-dim leading-relaxed">
                  {log.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
