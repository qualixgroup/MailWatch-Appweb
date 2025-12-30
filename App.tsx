
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
import { Rule, RuleStatus, ActivityLog, NotificationHistory } from './types';
import { AuthProvider } from './contexts/AuthContext';
import RequiresAuth from './components/RequiresAuth';
import Login from './views/Login';
import { logService } from './lib/logService';
import { ruleService } from './lib/ruleService';
import { notificationService } from './lib/notificationService';

const App: React.FC = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [notifications, setNotifications] = useState<NotificationHistory[]>([]);

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
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/google/callback" element={<AuthCallback />} />

          <Route path="/*" element={
            <RequiresAuth>
              <div className="flex h-screen w-full overflow-hidden">
                <Sidebar />
                <main className="flex-1 flex flex-col min-w-0 bg-background-dark relative overflow-hidden">
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
  );
};

export default App;
