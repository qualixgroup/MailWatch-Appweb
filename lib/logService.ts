
import { supabase } from './supabase';
import { ActivityLog } from '../types';

export const logService = {
    async fetchLogs(limit = 50): Promise<ActivityLog[]> {
        const { data, error } = await supabase
            .from('logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching logs:', error);
            return [];
        }

        return data.map((log: any) => ({
            ...log,
            timestamp: new Date(log.created_at).toLocaleString('pt-BR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            })
        }));
    },

    async addLog(log: Omit<ActivityLog, 'id' | 'timestamp' | 'created_at'>) {
        const { data, error } = await supabase
            .from('logs')
            .insert([
                {
                    type: log.type,
                    title: log.title,
                    description: log.description,
                    status: log.status,
                    details: log.details
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error adding log:', error);
            throw error;
        }

        return data;
    }
};
