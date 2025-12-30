
import React from 'react';
import { NotificationHistory } from '../types';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';

interface NotificationsProps {
  history: NotificationHistory[];
  onRefresh?: () => void;
}

const Notifications: React.FC<NotificationsProps> = ({ history, onRefresh }) => {
  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <PageHeader
        title="Histórico de Alertas"
        description="Acompanhe todos os alertas enviados automaticamente pelas suas regras de monitoramento."
      >
        <Button variant="secondary" icon="refresh" onClick={onRefresh}>
          Atualizar
        </Button>
        <Button
          variant="secondary"
          icon="delete_sweep"
          className="hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-500"
        >
          Limpar Histórico
        </Button>
      </PageHeader>

      <div className="bg-surface-dark border border-border-dark rounded-xl shadow-2xl overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-border-dark bg-background-dark/50 text-[10px] font-bold text-text-dim uppercase tracking-widest">
          <div className="col-span-1">Status</div>
          <div className="col-span-5">Regra / Detalhes</div>
          <div className="col-span-4">Destinatário</div>
          <div className="col-span-2 text-right">Data/Hora</div>
        </div>

        <div className="divide-y divide-border-dark">
          {history.length === 0 ? (
            <div className="p-8 text-center text-text-dim">
              Nenhuma notificação encontrada no histórico.
            </div>
          ) : (
            history.map((notif) => (
              <div key={notif.id} className="group p-4 hover:bg-white/5 transition-colors relative">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="col-span-1 flex items-center">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full border ${notif.status === 'sent'
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                      <span className="material-symbols-outlined text-[18px]">
                        {notif.status === 'sent' ? 'check' : 'error'}
                      </span>
                    </div>
                  </div>
                  <div className="col-span-11 md:col-span-5">
                    <p className="font-bold text-white">{notif.ruleName}</p>
                    {notif.error && <p className="text-xs text-red-400 mt-0.5">{notif.error}</p>}
                  </div>
                  <div className="col-span-11 md:col-span-4 flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold ${notif.status === 'sent' ? 'bg-indigo-500' : 'bg-red-500 opacity-50'}`}>
                      {notif.recipient[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-text-dim">{notif.recipient}</span>
                  </div>
                  <div className="col-span-11 md:col-span-2 text-right">
                    <span className="text-xs text-text-dim font-medium">{notif.timestamp}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;
