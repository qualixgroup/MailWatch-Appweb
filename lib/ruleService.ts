
import { supabase } from './supabase';
import { Rule, RuleStatus, RuleCondition } from '../types';

export const ruleService = {
    async fetchRules(): Promise<Rule[]> {
        const { data, error } = await supabase
            .from('rules')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching rules:', error);
            return [];
        }

        return data.map((rule: any) => ({
            id: rule.id,
            name: rule.name,
            subjectFilter: rule.subject_filter,
            condition: rule.condition as RuleCondition,
            notificationEmail: rule.notification_email,
            status: rule.status as RuleStatus,
            icon: rule.icon,
            createdAt: new Date(rule.created_at).toLocaleDateString('pt-BR')
        }));
    },

    async createRule(rule: Omit<Rule, 'id' | 'createdAt'>) {
        const { data, error } = await supabase
            .from('rules')
            .insert([
                {
                    name: rule.name,
                    subject_filter: rule.subjectFilter,
                    condition: rule.condition,
                    notification_email: rule.notificationEmail,
                    status: rule.status,
                    icon: rule.icon
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error creating rule:', error);
            throw error;
        }

        return data;
    },

    async updateRule(rule: Rule) {
        const { error } = await supabase
            .from('rules')
            .update({
                name: rule.name,
                subject_filter: rule.subjectFilter,
                condition: rule.condition,
                notification_email: rule.notificationEmail,
                status: rule.status,
                icon: rule.icon
            })
            .eq('id', rule.id);

        if (error) {
            console.error('Error updating rule:', error);
            throw error;
        }
    },

    async deleteRule(id: string) {
        const { error } = await supabase
            .from('rules')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting rule:', error);
            throw error;
        }
    },

    async toggleRuleStatus(id: string, currentStatus: RuleStatus) {
        const newStatus = currentStatus === RuleStatus.ACTIVE ? RuleStatus.PAUSED : RuleStatus.ACTIVE;

        const { error } = await supabase
            .from('rules')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) {
            console.error('Error toggling rule status:', error);
            throw error;
        }

        return newStatus;
    }
};
