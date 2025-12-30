
export enum RuleStatus {
  ACTIVE = 'Ativo',
  PAUSED = 'Pausado'
}

export enum RuleCondition {
  CONTAINS = 'Contém',
  STARTS_WITH = 'Começa com',
  EXACT = 'É exatamente',
  ENDS_WITH = 'Termina com',
  HAS_ATTACHMENT = 'Tem Anexo',
  ALWAYS = 'Sempre'
}

export interface Rule {
  id: string;
  name: string;
  subjectFilter: string;
  condition: RuleCondition;
  notificationEmail: string;
  status: RuleStatus;
  createdAt: string;
  icon?: string;
}

export interface ActivityLog {
  id: string;
  type: 'Notification' | 'RuleMatch' | 'EmailReceived' | 'RuleEdit' | 'ConnectionError' | 'UserLogin';
  title: string;
  description: string;
  timestamp: string;
  created_at?: string;
  details?: string;
  status?: 'success' | 'error' | 'info';
}

export interface NotificationHistory {
  id: string;
  status: 'sent' | 'failed';
  ruleName: string;
  recipient: string;
  timestamp: string;
  error?: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string; // From auth.user
  avatarUrl?: string;
  language: string;
  timezone: string;
  integrations: {
    google: boolean;
    slack: boolean;
  };
}
