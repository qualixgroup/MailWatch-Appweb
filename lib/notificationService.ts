
import { supabase } from './supabase';
import { NotificationHistory } from '../types';

export const notificationService = {
    async fetchNotifications(limit = 50): Promise<NotificationHistory[]> {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching notifications:', error);
            return [];
        }

        return data.map((notification: any) => ({
            id: notification.id,
            ruleName: notification.rule_name,
            recipient: notification.recipient,
            status: notification.status as 'sent' | 'failed',
            error: notification.error,
            timestamp: new Date(notification.created_at).toLocaleString('pt-BR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            })
        }));
    },

    async addNotification(notification: Omit<NotificationHistory, 'id' | 'timestamp'>) {
        // Obter usuário autenticado
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
            .from('notifications')
            .insert([
                {
                    rule_name: notification.ruleName,
                    recipient: notification.recipient,
                    status: notification.status,
                    error: notification.error,
                    user_id: user.id
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error adding notification:', error);
            throw error;
        }

        return data;
    },

    async clearHistory() {
        // Obter usuário autenticado
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // RLS policy garante que apenas notificações do usuário atual serão deletadas
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('user_id', user.id);

        if (error) {
            console.error('Error clearing history:', error);
            throw error;
        }
    }
};
