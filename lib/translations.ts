
export type Language = 'pt-BR' | 'en-US';

export const translations = {
    'pt-BR': {
        // General / Navigation
        'dashboard': 'Painel',
        'rules': 'Regras',
        'logs': 'Logs',
        'notifications': 'Notificações',
        'settings': 'Configurações',
        'login': 'Login',
        'logout': 'Sair',

        // Dashboard
        'total_emails': 'Emails Processados',
        'active_rules': 'Regras Ativas',
        'actions_taken': 'Ações Executadas',
        'last_check': 'Última Verificação',
        'monitor_running': 'Monitoramento Ativo',
        'monitor_paused': 'Monitoramento Pausado',
        'check_now': 'Verificar Agora',

        // Settings
        'settings_title': 'Configurações',
        'settings_desc': 'Gerencie suas preferências, conta e integrações do MailWatch.',
        'general': 'Geral',
        'account': 'Conta',
        'integrations': 'Integrações',
        'advanced': 'Avançado',

        // Settings - General
        'system_preferences': 'Preferências do Sistema',
        'monitor_interval': 'Intervalo de Monitoramento Automático',
        'monitor_interval_desc': 'Define a frequência com que o sistema verifica novos emails. Intervalos menores consomem mais quota da API do Gmail.',
        'appearance': 'Aparência',
        'appearance_desc': 'Alternar entre modo claro e escuro',
        'notification_sounds': 'Sons de Notificação',
        'notification_sounds_desc': 'Tocar som ao aplicar regras',
        'visual_notifications': 'Notificações Visuais',
        'visual_notifications_desc': 'Exibir popups de status',

        // Settings - Account
        'user_profile': 'Perfil do Usuário',
        'full_name': 'Nome Completo',
        'language': 'Idioma',
        'timezone': 'Fuso Horário',
        'save_changes': 'Salvar Alterações',
        'saving': 'Salvando...',
        'success_save': 'Configurações salvas com sucesso!',
        'error_save': 'Erro ao salvar configurações.',

        // Settings - Integrations
        'connected_integrations': 'Integrações Conectadas',
        'active_sync': 'Sincronização Ativa',
        'disconnected': 'Desconectado',
        'connect': 'Conectar',
        'disconnect': 'Desconectar',
        'connect_google': 'Conectar com Google',
        'connect_whatsapp': 'Conectar WhatsApp',

        // Common
        'loading': 'Carregando...',
        'error': 'Erro',
        'success': 'Sucesso',
        'cancel': 'Cancelar',
        'save': 'Salvar',
        'delete': 'Excluir',
        'edit': 'Editar',
        'search': 'Buscar...',
        'apply_rules': 'Aplicar Regras',
        'actions': 'Ações',
    },
    'en-US': {
        // General / Navigation
        'dashboard': 'Dashboard',
        'rules': 'Rules',
        'logs': 'Logs',
        'notifications': 'Notifications',
        'settings': 'Settings',
        'login': 'Login',
        'logout': 'Logout',

        // Dashboard
        'total_emails': 'Processed Emails',
        'active_rules': 'Active Rules',
        'actions_taken': 'Actions Taken',
        'last_check': 'Last Check',
        'monitor_running': 'Monitoring Active',
        'monitor_paused': 'Monitoring Paused',
        'check_now': 'Check Now',

        // Settings
        'settings_title': 'Settings',
        'settings_desc': 'Manage your preferences, account and MailWatch integrations.',
        'general': 'General',
        'account': 'Account',
        'integrations': 'Integrations',
        'advanced': 'Advanced',

        // Settings - General
        'system_preferences': 'System Preferences',
        'monitor_interval': 'Automatic Monitoring Interval',
        'monitor_interval_desc': 'Sets how often the system checks for new emails. Shorter intervals consume more Gmail API quota.',
        'appearance': 'Appearance',
        'appearance_desc': 'Toggle between light and dark mode',
        'notification_sounds': 'Notification Sounds',
        'notification_sounds_desc': 'Play sound when rules are applied',
        'visual_notifications': 'Visual Notifications',
        'visual_notifications_desc': 'Show status popups',

        // Settings - Account
        'user_profile': 'User Profile',
        'full_name': 'Full Name',
        'language': 'Language',
        'timezone': 'Timezone',
        'save_changes': 'Save Changes',
        'saving': 'Saving...',
        'success_save': 'Settings saved successfully!',
        'error_save': 'Error saving settings.',

        // Settings - Integrations
        'connected_integrations': 'Connected Integrations',
        'active_sync': 'Sync Active',
        'disconnected': 'Disconnected',
        'connect': 'Connect',
        'disconnect': 'Disconnect',
        'connect_google': 'Connect with Google',
        'connect_whatsapp': 'Connect WhatsApp',

        // Common
        'loading': 'Loading...',
        'error': 'Error',
        'success': 'Success',
        'cancel': 'Cancel',
        'save': 'Save',
        'delete': 'Delete',
        'edit': 'Edit',
        'search': 'Search...',
        'apply_rules': 'Apply Rules',
        'actions': 'Actions',
    }
};
