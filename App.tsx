import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './views/Dashboard';
import Rules from './views/Rules';
import RuleEditor from './views/RuleEditor';
import Logs from './views/Logs';
import Notifications from './views/Notifications';
import Settings from './views/Settings';
import AuthCallback from './views/AuthCallback';
import WhatsAppConnect from './views/WhatsAppConnect';
import { Rule, RuleStatus, ActivityLog, NotificationHistory } from './types';
import { AuthProvider } from './contexts/AuthContext';
import RequiresAuth from './components/RequiresAuth';
import Login from './views/Login';
import { logService } from './lib/logService';
import { ruleService } from './lib/ruleService';
import { notificationService } from './lib/notificationService';
import { realtimeService } from './lib/realtimeService';
import { supabase } from './lib/supabase';
import { ToastProvider, useToast, setGlobalToast, showToast } from './components/Toast';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';

// Component to initialize global toast
const ToastInitializer: React.FC = () => {
  const { addToast } = useToast();
  useEffect(() => {
    setGlobalToast(addToast);
  }, [addToast]);
  return null;
};

// Component to handle theme application
const ThemeInitializer: React.FC = () => {
  useEffect(() => {
    // Forces Dark Mode globally
    document.documentElement.classList.add('dark');
  }, []);

  return null;
};

const App: React.FC = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [notifications, setNotifications] = useState<NotificationHistory[]>([]);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const fetchLogs = async () => {
    const data = await logService.fetchLogs();
    setLogs(data);
  };

  const fetchRules = async () => {
    const data = await ruleService.fetchRules();
    setRules(data);
  };

  const fetchNotifications = async () => {
    const data = await notificationService.fetchNotifications();
    setNotifications(data);
  };

  useEffect(() => {
    fetchLogs();
    fetchRules();
    fetchNotifications();
  }, []);

  // Supabase Realtime subscriptions for live updates
  useEffect(() => {
    let unsubscribeConnection: (() => void) | null = null;
    let isSubscribed = false;

    const initializeRealtime = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.log('[App] No user authenticated, skipping realtime setup');
        return;
      }

      console.log('[App] Setting up realtime for user:', user.id);

      // Subscribe to connection status changes
      unsubscribeConnection = realtimeService.onConnectionChange((connected) => {
        setIsRealtimeConnected(connected);
        if (connected) {
          console.log('🟢 [App] Realtime connected for user:', user.id);
        }
      });

      // Subscribe to all realtime events with user ID filter
      await realtimeService.subscribeAll(user.id, {
        onLogsInsert: (payload) => {
          // Add new log to the top of the list
          const newLog = payload.new;
          console.log('📋 [App] New log received:', newLog);
          const formattedLog: ActivityLog = {
            ...newLog,
            timestamp: new Date(newLog.created_at).toLocaleString('pt-BR', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })
          };
          setLogs(prev => [formattedLog, ...prev].slice(0, 50));

          // Show toast for important events
          if (newLog.status === 'success' && newLog.type === 'RuleMatch') {
            showToast({
              type: 'success',
              title: 'Regra Aplicada',
              message: newLog.title
            });
          }
        },
        onNotificationsInsert: (payload) => {
          // Add new notification to the top of the list
          const newNotif = payload.new;
          console.log('🔔 [App] New notification received:', newNotif);
          const formattedNotif: NotificationHistory = {
            id: newNotif.id,
            ruleName: newNotif.rule_name,
            recipient: newNotif.recipient,
            status: newNotif.status as 'sent' | 'failed',
            error: newNotif.error,
            timestamp: new Date(newNotif.created_at).toLocaleString('pt-BR', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })
          };
          setNotifications(prev => [formattedNotif, ...prev].slice(0, 50));

          // Show toast for new notifications
          showToast({
            type: newNotif.status === 'sent' ? 'success' : 'error',
            title: newNotif.status === 'sent' ? 'Alerta Enviado' : 'Falha no Alerta',
            message: `${newNotif.rule_name} → ${newNotif.recipient}`
          });
        },
        onProcessedEmailsInsert: (payload) => {
          console.log('📧 [App] Email processed in realtime:', payload.new);
          // Refresh dashboard stats
          fetchLogs();
        }
      });

      isSubscribed = true;
    };

    initializeRealtime();

    // Also listen for auth state changes to reinitialize realtime
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('[App] User signed in, reinitializing realtime');
        initializeRealtime();
      } else if (event === 'SIGNED_OUT') {
        console.log('[App] User signed out, cleaning up realtime');
        realtimeService.cleanup();
        setIsRealtimeConnected(false);
      }
    });

    return () => {
      unsubscribeConnection?.();
      authSubscription.unsubscribe();
      realtimeService.cleanup();
    };
  }, []);

  const addRule = async (rule: Omit<Rule, 'id' | 'createdAt'>) => {
    try {
      await ruleService.createRule(rule);
      await fetchRules();
    } catch (error) {
      console.error('Failed to add rule', error);
    }
  };

  const updateRule = async (updatedRule: Rule) => {
    try {
      await ruleService.updateRule(updatedRule);
      await fetchRules();
    } catch (error) {
      console.error('Failed to update rule', error);
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await ruleService.deleteRule(id);
      await fetchRules();
    } catch (error) {
      console.error('Failed to delete rule', error);
    }
  };

  const toggleRuleStatus = async (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;

    try {
      await ruleService.toggleRuleStatus(id, rule.status);
      await fetchRules();
    } catch (error) {
      console.error('Failed to toggle rule status', error);
    }
  };

  return (
    <SettingsProvider>
      <ThemeInitializer />
      <ToastProvider>
        <ToastInitializer />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/auth/google/callback" element={<AuthCallback />} />

              <Route path="/*" element={
                <RequiresAuth>
                  <div className="flex h-screen w-full overflow-hidden">
                    <Sidebar />
                    <main className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-background-dark relative overflow-hidden transition-colors">
                      <Header />
                      <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth lg:ml-64">
                        <div className="max-w-7xl mx-auto">
                          <Routes>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={<Dashboard rules={rules} logs={logs} onToggleRule={toggleRuleStatus} />} />
                            <Route path="/rules" element={<Rules rules={rules} onToggleRule={toggleRuleStatus} onDeleteRule={deleteRule} />} />
                            <Route path="/rules/new" element={<RuleEditor onSave={addRule} />} />
                            <Route path="/rules/edit/:id" element={<RuleEditor rules={rules} onSave={updateRule} onDelete={deleteRule} />} />
                            <Route path="/logs" element={<Logs logs={logs} onRefresh={fetchLogs} />} />
                            <Route path="/notifications" element={<Notifications history={notifications} onRefresh={fetchNotifications} />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/whatsapp-connect" element={<WhatsAppConnect />} />
                          </Routes>
                        </div>
                      </div>
                    </main>
                  </div>
                </RequiresAuth>
              } />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </SettingsProvider>
  );
};

export default App;
