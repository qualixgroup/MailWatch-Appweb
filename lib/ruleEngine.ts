import { gmailService, GmailMessage } from './gmailService';
import { ruleService } from './ruleService';
import { logService } from './logService';
import { notificationService } from './notificationService';
import { supabase, SUPABASE_URL } from './supabase';
import { Rule, RuleStatus } from '../types';

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
            const subjectMatch = email.subject.toLowerCase().includes(rule.subjectFilter.toLowerCase());
            if (subjectMatch) {
                criteria.push(`Assunto contém "${rule.subjectFilter}"`);
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
            let emailError = null;

            if (rule.notificationEmail) {
                try {
                    const { data: { session } } = await supabase.auth.getSession();

                    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session?.access_token}`,
                        },
                        body: JSON.stringify({
                            to: rule.notificationEmail,
                            ruleName: rule.name,
                            emailFrom: email.from,
                            emailSubject: email.subject,
                            emailSnippet: email.snippet,
                            matchedCriteria: criteria
                        })
                    });

                    if (response.ok) {
                        emailSent = true;
                        actions.push(`Email enviado para ${rule.notificationEmail}`);
                    } else {
                        const errorData = await response.json();
                        emailError = errorData.error || 'Falha ao enviar email';
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

            // Create notification record
            await notificationService.addNotification({
                status: emailSent ? 'sent' : 'failed',
                ruleName: rule.name,
                recipient: rule.notificationEmail || 'N/A',
                error: emailError || undefined
            });

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
