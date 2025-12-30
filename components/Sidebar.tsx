
import React from 'react';
import { NavLink } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

const Sidebar: React.FC = () => {
  const { signOut, user } = useAuth();

  const navItems = [
    { name: 'Painel', path: '/dashboard', icon: 'dashboard' },
    { name: 'Regras de Email', path: '/rules', icon: 'rule' },
    { name: 'Notificações', path: '/notifications', icon: 'notifications' },
    { name: 'Logs', path: '/logs', icon: 'description' },
    { name: 'Configurações', path: '/settings', icon: 'settings' },
  ];

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <aside className="w-64 hidden lg:flex flex-col border-r border-border-dark bg-surface-dark p-6 fixed h-full z-20">
      <div className="flex items-center gap-3 mb-10">
        <div className="flex items-center justify-center size-10 rounded-xl bg-primary/20 text-primary shadow-lg shadow-primary/10">
          <span className="material-symbols-outlined text-2xl font-bold">mark_email_read</span>
        </div>
        <div className="flex flex-col">
          <h1 className="text-white text-lg font-bold leading-tight tracking-tight">MailWatch</h1>
          <p className="text-text-dim text-xs font-medium">Monitor de Automação</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group
              ${isActive
                ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                : 'text-text-dim hover:bg-white/5 hover:text-white'
              }
            `}
          >
            <span className={`material-symbols-outlined ${item.icon === 'notifications' ? '' : 'group-hover:text-primary transition-colors'}`}>
              {item.icon}
            </span>
            <span className="text-sm">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="pt-6 border-t border-border-dark">
        <div className="flex items-center gap-3 p-2 bg-background-dark/50 rounded-xl border border-border-dark">
          <div
            className="size-10 rounded-full bg-cover bg-center border border-border-dark"
            style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDeYcJUBUH9ZytrHwaCPoac4AfCPQSCS_oDAOBYnF6jo98J4NGpUWzmkQvLoK-TNP_ZCtHGtocKBX7bSiNb0WmhybMg8dUmM9gS5CNf4PB_q-jhFUwgx0Kt13V5-pY1Q_k5GLUmHMUOMhzSpmBtDPQjJ5aPCeCWiumrgK1dqSHrsIOcka9sAA7FarJIMrzDGvbB2blQ0tJnuYD2ycmvtDHlPJ-IVXqmQewYg0Kda3AGttFEMnbCDToATNj5804Jd1Ct4ljcKDW0ph8f')" }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{user?.email || 'Usuário'}</p>
            <p className="text-xs text-text-dim truncate">Plano Pro</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-text-dim hover:text-white transition-colors p-1"
            title="Sair da conta"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
