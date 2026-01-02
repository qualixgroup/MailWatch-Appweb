import { gmailService, GmailMessage } from './gmailService';
import { ruleService } from './ruleService';
import { logService } from './logService';
import { notificationService } from './notificationService';
import { whatsappService } from './whatsappService';
import { supabase } from './supabase';
import { Rule, RuleStatus, RuleCondition } from '../types';

export interface RuleMatch {
    rule: Rule;
    email: GmailMessage;
    matchedCriteria: string[];
}

export const ruleEngine = {
    /**
     * Check if an email matches a rule's criteria
     */
    matchesRule(email: GmailMessage, rule: Rule): { matches: boolean; criteria: string[] } {
        const criteria: string[] = [];

        // Check subject filter
        if (rule.subjectFilter) {
            const subjectLC = email.subject.toLowerCase();
            const filterLC = rule.subjectFilter.toLowerCase();
            let subjectMatch = false;

            // Maps user friendly condition string back to logic
            // Note: RuleCondition enum values are the display strings (e.g. 'É exatamente')
            switch (rule.condition) {
                case RuleCondition.EXACT:
                    subjectMatch = subjectLC === filterLC;
                    break;
                case RuleCondition.STARTS_WITH:
                    subjectMatch = subjectLC.startsWith(filterLC);
                    break;
                case RuleCondition.ENDS_WITH:
                    subjectMatch = subjectLC.endsWith(filterLC);
                    break;
                case RuleCondition.ALWAYS:
                    subjectMatch = true;
                    break;
                case RuleCondition.CONTAINS:
                default:
                    subjectMatch = subjectLC.includes(filterLC);
                    break;
            }

            if (subjectMatch) {
                criteria.push(`Filtro "${rule.condition}": "${rule.subjectFilter}"`);
            }
        }

        // Check sender filter
        if (rule.senderFilter) {
            const senderMatch = email.from.toLowerCase().includes(rule.senderFilter.toLowerCase());
            if (senderMatch) {
                criteria.push(`Remetente contém "${rule.senderFilter}"`);
            }
        }

        // Check keywords in snippet/body
        if (rule.keywords && rule.keywords.length > 0) {
            const matchedKeywords = rule.keywords.filter(kw =>
                email.subject.toLowerCase().includes(kw.toLowerCase()) ||
                email.snippet.toLowerCase().includes(kw.toLowerCase())
            );
            if (matchedKeywords.length > 0) {
                criteria.push(`Palavras-chave: ${matchedKeywords.join(', ')}`);
            }
        }

        // Rule matches if any criteria was met (depending on rule logic)
        const matches = criteria.length > 0;
        return { matches, criteria };
    },

    /**
     * Apply actions for a matched rule
     */
    async applyRuleActions(email: GmailMessage, rule: Rule, criteria: string[] = []): Promise<boolean> {
        try {
            const actions: string[] = [];

            // Mark as read if configured
            if (rule.actions?.markAsRead) {
                await gmailService.markAsRead(email.id);
                actions.push('Marcado como lido');
            }

            // Archive if configured
            if (rule.actions?.archive) {
                await gmailService.archiveEmail(email.id);
                actions.push('Arquivado');
            }

            // Apply label if configured
            if (rule.actions?.applyLabel) {
                await gmailService.applyLabel(email.id, rule.actions.applyLabel);
                actions.push(`Label aplicada: ${rule.actions.applyLabel}`);
            }

            // Send email notification if configured
            let emailSent = false;
            let emailError: string | null = null;

            if (rule.notificationEmail) {
                try {
                    const result = await gmailService.sendRuleNotification({
                        to: rule.notificationEmail,
                        ruleName: rule.name,
                        emailFrom: email.from,
                        emailSubject: email.subject,
                        emailSnippet: email.snippet,
                        matchedCriteria: criteria
                    });

                    if (result.success) {
                        emailSent = true;
                        actions.push(`Email enviado para ${rule.notificationEmail}`);
                    } else {
                        emailError = result.error || 'Falha ao enviar email';
                    }
                } catch (err: any) {
                    emailError = err.message || 'Erro ao enviar notificação';
                    console.error('Error sending notification email:', err);
                }
            }

            // Log the action
            await logService.addLog({
                type: 'RuleMatch',
                title: `Regra "${rule.name}" aplicada`,
                description: `Email: "${email.subject}" de ${email.from}. Ações: ${actions.join(', ')}`,
                status: emailError ? 'error' : 'success'
            });

            // Create notification record for Email
            await notificationService.addNotification({
                status: emailSent ? 'sent' : 'failed',
                ruleName: rule.name,
                recipient: rule.notificationEmail || 'N/A',
                error: emailError || undefined
            });

            // Send WhatsApp notification if configured
            if (rule.whatsappNumber) {
                try {
                    // Get instance name for user
                    const { data: instanceData } = await supabase
                        .from('whatsapp_instances')
                        .select('instance_name')
                        .single();

                    if (instanceData?.instance_name) {
                        const wsMessage = `📢 *Alerta MailWatch*\n\n*Regra:* ${rule.name}\n*De:* ${email.from}\n*Assunto:* ${email.subject}\n*Prévia:* ${email.snippet}\n\n_Notificação enviada automaticamente_`;

                        await whatsappService.sendTextMessage(
                            instanceData.instance_name,
                            rule.whatsappNumber,
                            wsMessage
                        );
                        actions.push(`WhatsApp enviado para ${rule.whatsappNumber}`);

                        // Log and record WhatsApp notification
                        await notificationService.addNotification({
                            status: 'sent',
                            ruleName: rule.name,
                            recipient: `WA: ${rule.whatsappNumber}`,
                        });
                    }
                } catch (err: any) {
                    console.error('Error sending WhatsApp notification:', err);
                    await notificationService.addNotification({
                        status: 'failed',
                        ruleName: rule.name,
                        recipient: `WA: ${rule.whatsappNumber}`,
                        error: err.message || 'Erro Evolution API'
                    });
                }
            }

            return true;
        } catch (error) {
            console.error('Error applying rule actions:', error);

            // Log the error
            await logService.addLog({
                type: 'RuleMatch',
                title: `Erro ao aplicar regra "${rule.name}"`,
                description: `Falha ao processar email: "${email.subject}"`,
                status: 'error'
            });

            return false;
        }
    },

    /**
     * Process new emails against all active rules
     */
    async processEmails(emails: GmailMessage[]): Promise<RuleMatch[]> {
        const matches: RuleMatch[] = [];

        try {
            // Fetch active rules
            const rules = await ruleService.fetchRules();
            const activeRules = rules.filter(r => r.status === RuleStatus.ACTIVE);

            if (activeRules.length === 0) {
                console.log('No active rules to process');
                return matches;
            }

            // Process each email against each rule
            for (const email of emails) {
                for (const rule of activeRules) {
                    const { matches: doesMatch, criteria } = this.matchesRule(email, rule);

                    if (doesMatch) {
                        matches.push({
                            rule,
                            email,
                            matchedCriteria: criteria
                        });

                        // Apply the rule actions
                        await this.applyRuleActions(email, rule, criteria);
                    }
                }
            }

            if (matches.length > 0) {
                console.log(`Applied ${matches.length} rules to emails`);
            }

            return matches;
        } catch (error) {
            console.error('Error processing emails with rules:', error);
            return matches;
        }
    },

    /**
     * Process a single email manually
     */
    async processEmail(email: GmailMessage): Promise<RuleMatch[]> {
        return this.processEmails([email]);
    }
};
