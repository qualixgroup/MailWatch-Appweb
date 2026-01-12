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

            // 1. Check if ANY action for this rule/email has been processed
            const { data: existing } = await supabase
                .from('processed_emails')
                .select('id')
                .eq('message_id', email.id)
                .eq('rule_id', rule.id!)
                .limit(1)
                .single();

            if (existing) {
                // Already processed
                return true;
            }

            let emailSent = false;
            let emailError: string | null = null;
            let whatsAppSent = false;
            let whatsAppError: string | null = null;

            const { data: userData } = await supabase.auth.getUser();
            const currentUserId = userData.user?.id;

            if (!currentUserId) throw new Error('User not authenticated');

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

            // Send Email Notification if configured
            if (rule.notificationEmail) {
                try {
                    const result = await gmailService.sendEmail({
                        to: rule.notificationEmail,
                        subject: `Alerta: Regra "${rule.name}" acionada`,
                        body: `Regra Acionada: ${rule.name}\n\nDe: ${email.from}\nAssunto: ${email.subject}\nPrévia: ${email.snippet}`,
                        htmlBody: `
                            <h2>Regra Acionada: ${rule.name}</h2>
                            <p>Uma nova mensagem correspondeu à sua regra no MailWatch.</p>
                            <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #00E699; margin: 20px 0;">
                                <p><strong>De:</strong> ${email.from}</p>
                                <p><strong>Assunto:</strong> ${email.subject}</p>
                                <p><strong>Prévia:</strong> ${email.snippet}</p>
                            </div>
                        `
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
                        whatsAppSent = true;
                        actions.push(`WhatsApp enviado para ${rule.whatsappNumber}`);
                    }
                } catch (err: any) {
                    whatsAppError = err.message || 'Erro Evolution API';
                    console.error('Error sending WhatsApp notification:', err);
                }
            }

            // Centralized Logging & Recording
            await notificationService.addNotification({
                status: (emailSent || whatsAppSent) ? 'sent' : 'failed',
                ruleName: rule.name,
                recipient: [rule.notificationEmail, rule.whatsappNumber ? `WA:${rule.whatsappNumber}` : ''].filter(Boolean).join(', '),
                error: emailError || whatsAppError || undefined
            });

            await logService.addLog({
                type: 'RuleMatch',
                title: `Regra "${rule.name}" aplicada`,
                description: `Email: "${email.subject}". Ações: ${actions.join(', ')}`,
                status: (emailSent || whatsAppSent) ? 'success' : 'error'
            });

            // Mark as processed to prevent duplicates
            if (emailSent || whatsAppSent) {
                await supabase.from('processed_emails').insert({
                    user_id: currentUserId,
                    message_id: email.id,
                    rule_id: rule.id,
                    action_type: 'rule_execution'
                });
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
    },

    /**
     * Process ALL emails from today and return a summary
     * Returns: { alreadyProcessed, newlyProcessed, totalToday }
     */
    async processAllTodayEmails(): Promise<{
        alreadyProcessed: number;
        newlyProcessed: number;
        totalToday: number;
        message: string;
    }> {
        try {
            // 1. Get user ID
            const { data: userData } = await supabase.auth.getUser();
            const userId = userData.user?.id;
            if (!userId) throw new Error('User not authenticated');

            // 2. Fetch ALL emails from today
            console.log('Fetching all emails from today...');
            const allTodayEmails = await gmailService.fetchAllTodayEmails();

            if (allTodayEmails.length === 0) {
                return {
                    alreadyProcessed: 0,
                    newlyProcessed: 0,
                    totalToday: 0,
                    message: 'Nenhum email encontrado para hoje.'
                };
            }

            // 3. Get IDs of already processed emails (today)
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { data: processedData } = await supabase
                .from('processed_emails')
                .select('message_id')
                .eq('user_id', userId)
                .gte('created_at', today.toISOString());

            const processedIds = new Set((processedData || []).map(p => p.message_id));
            const alreadyProcessed = processedIds.size;

            // 4. Filter out already processed emails
            const unprocessedEmails = allTodayEmails.filter(email => !processedIds.has(email.id));

            console.log(`Found ${allTodayEmails.length} emails today, ${alreadyProcessed} already processed, ${unprocessedEmails.length} to process`);

            // 5. Process only the new ones
            let newlyProcessed = 0;
            if (unprocessedEmails.length > 0) {
                const matches = await this.processEmails(unprocessedEmails);
                newlyProcessed = matches.length;
            }

            // 6. Build summary message
            let message = '';
            if (alreadyProcessed > 0 && newlyProcessed > 0) {
                message = `✅ ${alreadyProcessed} notificação(ões) já enviada(s) hoje + ${newlyProcessed} nova(s) agora!`;
            } else if (alreadyProcessed > 0 && newlyProcessed === 0) {
                message = `✅ ${alreadyProcessed} notificação(ões) já enviada(s) hoje. Nenhuma nova correspondência.`;
            } else if (newlyProcessed > 0) {
                message = `✅ ${newlyProcessed} nova(s) notificação(ões) enviada(s)!`;
            } else {
                message = `Nenhum email correspondeu às regras ativas. (${allTodayEmails.length} emails verificados)`;
            }

            return {
                alreadyProcessed,
                newlyProcessed,
                totalToday: allTodayEmails.length,
                message
            };

        } catch (error: any) {
            console.error('Error processing all today emails:', error);
            return {
                alreadyProcessed: 0,
                newlyProcessed: 0,
                totalToday: 0,
                message: `Erro: ${error.message || 'Falha ao processar emails'}`
            };
        }
    }
};
