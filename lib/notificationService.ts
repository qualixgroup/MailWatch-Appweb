
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
        const { data, error } = await supabase
            .from('notifications')
            .insert([
                {
                    rule_name: notification.ruleName,
                    recipient: notification.recipient,
                    status: notification.status,
                    error: notification.error
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
        const { error } = await supabase
            .from('notifications')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (hacky way to safely delete all if no where clause is unsafe, but usually .delete().neq is fine or simply allowing full delete policy)
        // proper way to delete all rows:
        // .delete().gte('created_at', '1970-01-01') or similar. 
        // Supabase-js requires a filter for delete.

        if (error) {
            console.error('Error clearing history:', error);
            throw error;
        }
    }
};
