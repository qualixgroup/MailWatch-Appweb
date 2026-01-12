
import React from 'react';
import { useLocation } from 'react-router-dom';

const Header: React.FC = () => {
  const location = useLocation();
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'Visão Geral';
    if (path.includes('/rules')) return 'Regras de E-mail';
    if (path.includes('/notifications')) return 'Histórico de Notificações';
    if (path.includes('/logs')) return 'Logs de Atividade';
    if (path.includes('/settings')) return 'Configurações';
    return 'Painel';
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden flex items-center justify-between p-4 border-b border-gray-200 dark:border-border-dark bg-white dark:bg-surface-dark">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white font-bold">
          <span className="material-symbols-outlined text-primary">mark_email_read</span>
          <span>MailWatch</span>
        </div>
        <button className="text-gray-900 dark:text-white p-2">
          <span className="material-symbols-outlined">menu</span>
        </button>
      </header>

      {/* Desktop Header */}
      <header className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-gray-200 dark:border-border-dark bg-white/80 dark:bg-background-dark/50 backdrop-blur-md sticky top-0 z-10 lg:ml-64">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{getPageTitle()}</h2>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <span className="absolute top-2.5 left-3 text-gray-400 dark:text-text-dim group-focus-within:text-primary material-symbols-outlined text-[20px] transition-colors">search</span>
            <input
              className="bg-gray-100 dark:bg-surface-dark border border-gray-200 dark:border-border-dark text-sm rounded-lg pl-10 pr-4 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary w-64 placeholder-gray-400 dark:placeholder-text-dim/50 transition-all"
              placeholder="Buscar..."
              type="text"
            />
          </div>

          <div className="h-6 w-px bg-gray-200 dark:bg-border-dark mx-1"></div>

          <div className="flex items-center gap-1 bg-gray-100 dark:bg-surface-dark border border-gray-200 dark:border-border-dark rounded-lg p-1">
            <button className="px-2.5 py-1 text-xs font-medium text-gray-500 dark:text-text-dim hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/5 rounded transition-colors">EN</button>
            <button className="px-2.5 py-1 text-xs font-bold text-primary bg-primary/10 rounded shadow-sm border border-primary/20 cursor-default">PT</button>
          </div>

          <button className="p-2 text-gray-500 dark:text-text-dim hover:text-primary hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors" title="Notificações">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border border-background-dark"></span>
          </button>

          <button className="p-2 text-gray-500 dark:text-text-dim hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">
            <span className="material-symbols-outlined text-[20px]">help</span>
          </button>
        </div>
      </header>
    </>
  );
};

export default Header;
