import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

enum RuleCondition {
    CONTAINS = 'Contém',
    STARTS_WITH = 'Começa com',
    EXACT = 'É exatamente',
    ENDS_WITH = 'Termina com',
    ALWAYS = 'Sempre'
}

interface Rule {
    id: string;
    name: string;
    subjectFilter: string;
    senderFilter?: string;
    keywords?: string[];
    condition: RuleCondition;
    notification_emails?: string[];
    whatsapp_numbers?: string[];
    status: string;
    actions?: {
        markAsRead?: boolean;
        archive?: boolean;
        applyLabel?: string;
    };
}

function checkMatch(text: string, filter: string, condition: string): boolean {
    if (!text) return false;
    const t = text.toLowerCase();
    const f = filter.toLowerCase();

    switch (condition) {
        case RuleCondition.EXACT:
            return t === f;
        case RuleCondition.STARTS_WITH:
            return t.startsWith(f);
        case RuleCondition.ENDS_WITH:
            return t.endsWith(f);
        case RuleCondition.ALWAYS:
            return true;
        case RuleCondition.CONTAINS:
        default:
            return t.includes(f);
    }
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const payload = await req.json(); // { mode: 'incremental', userId: '...', historyId: '123' } OR empty for full scan

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
        const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
        const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
        const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

        if (!googleClientId || !googleClientSecret) {
            throw new Error("Missing Google Client ID/Secret env vars");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const results = [];
        const debugLogs: string[] = [];

        // Determine targets: Specific user (Webhook) or All users (Cron)
        let targetUsers = [];
        if (payload.userId) {
            // Webhook mode
            targetUsers.push({ id: payload.userId });
        } else {
            // Cron mode - List all users
            const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
            if (usersError) throw usersError;
            targetUsers = users;
        }

        for (const listUser of targetUsers) {
            // Fetch user details mostly to communicate if needed, but we rely on IDs
            const log = (msg: string) => {
                console.log(`[User ${listUser.id}] ${msg}`);
                debugLogs.push(`[User ${listUser.id}] ${msg}`);
            };

            try {
                // 1. Get Refresh Token & History ID
                const { data: tokenRecord } = await supabase
                    .from('user_gmail_tokens')
                    .select('refresh_token, history_id')
                    .eq('user_id', listUser.id)
                    .single();

                let refreshToken = tokenRecord?.refresh_token;

                // Fallback to identity if needed (mostly for legacy)
                if (!refreshToken) {
                    const { data: { user } } = await supabase.auth.admin.getUserById(listUser.id);
                    const googleIdentity = user?.identities?.find((id) => id.provider === "google");
                    if (googleIdentity?.identity_data?.provider_refresh_token) {
                        refreshToken = googleIdentity.identity_data.provider_refresh_token;
                    }
                }

                if (!refreshToken) {
                    log("No refresh token found");
                    continue;
                }

                // 2. Refresh Access Token
                const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                        client_id: googleClientId,
                        client_secret: googleClientSecret,
                        refresh_token: refreshToken,
                        grant_type: "refresh_token",
                    }),
                });

                if (!tokenResponse.ok) {
                    log(`Failed to refresh token: ${tokenResponse.status}`);
                    continue;
                }

                const tokenData = await tokenResponse.json();
                const accessToken = tokenData.access_token;

                // 3. Fetch Active Rules
                const { data: rules } = await supabase
                    .from("rules")
                    .select("*")
                    .eq("user_id", listUser.id)
                    .eq("status", "Ativo");

                if (!rules || rules.length === 0) {
                    log("No active rules");
                    continue; // But we might still want to update historyId if it's a sync run? Not strictly necessary.
                }

                // 4. Fetch Emails (Incremental vs Full)
                let messages: any[] = [];

                // If Webhook mode (incremental) and we have a previous historyId
                if (payload.mode === 'incremental' && payload.historyId && tokenRecord?.history_id) {
                    log(`Incremental sync from historyId ${tokenRecord.history_id}`);

                    // Gmail history.list
                    const historyUrl = `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${tokenRecord.history_id}&labelId=INBOX&historyTypes=messageAdded`;
                    const historyRes = await fetch(historyUrl, {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    });

                    if (historyRes.ok) {
                        const historyData = await historyRes.json();
                        // Extract messages added
                        if (historyData.history && historyData.history.length > 0) {
                            for (const h of historyData.history) {
                                if (h.messagesAdded) {
                                    for (const m of h.messagesAdded) {
                                        if (m.message) messages.push(m.message); // Only ID and ThreadID here
                                    }
                                }
                            }
                        } else {
                            log("No new messages found since last historyId");
                        }
                    } else {
                        // History ID might be too old (404), fall back to list?
                        // For now, simple logging errors
                        log(`History fetch failed: ${historyRes.status}`);
                    }

                } else {
                    // Full Scan Mode (Default / Fallback)
                    log("Full inbox scan (standard mode)");
                    const gmailResponse = await fetch(
                        "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=INBOX&q=is:unread category:primary",
                        {
                            headers: { Authorization: `Bearer ${accessToken}` }
                        }
                    );

                    if (gmailResponse.ok) {
                        const gmailData = await gmailResponse.json();
                        messages = gmailData.messages || [];
                    }
                }

                log(`Processing ${messages.length} messages`);

                // 5. Process Each Message
                for (const metaMsg of messages) {
                    // Deduplication Check (early, before fetching full content)
                    // Optimization: We check DB first.
                    const { data: alreadyProcessed } = await supabase
                        .from("processed_emails")
                        .select("id")
                        .eq("message_id", metaMsg.id)
                        .limit(1); // Check against any rule for this message ID? Actually we check per rule usually.

                    // Actually, we check Per-Rule in the inner loop, but we can't optimize much without knowing rules.
                    // But if ALL rules for a msg are done? Hard to tracking.
                    // Fetch full content
                    const msgRes = await fetch(
                        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${metaMsg.id}?format=full`,
                        { headers: { Authorization: `Bearer ${accessToken}` } }
                    );

                    if (!msgRes.ok) continue;
                    const email = await msgRes.json();

                    const headers = email.payload?.headers || [];
                    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

                    const subject = getHeader('subject');
                    const from = getHeader('from');
                    const snippet = email.snippet || "";

                    for (const rule of rules) {
                        // Check duplicates specific to this Rule + Message
                        const { data: existing } = await supabase
                            .from("processed_emails")
                            .select("id")
                            .eq("message_id", email.id)
                            .eq("rule_id", rule.id)
                            .limit(1)
                            .maybeSingle();

                        if (existing) continue;

                        const matchedCriteria: string[] = [];
                        const hasSubjectReq = !!rule.subjectFilter;
                        const hasSenderReq = !!rule.senderFilter;
                        const hasKeywordsReq = rule.keywords && rule.keywords.length > 0;

                        // Match Logic
                        if (hasSubjectReq && checkMatch(subject, rule.subjectFilter, rule.condition)) {
                            matchedCriteria.push(`Filtro "${rule.condition}": "${rule.subjectFilter}"`);
                        }
                        if (hasSenderReq && from.toLowerCase().includes(rule.senderFilter.toLowerCase())) {
                            matchedCriteria.push(`Remetente contém "${rule.senderFilter}"`);
                        }
                        if (hasKeywordsReq) {
                            const kws = rule.keywords.filter((kw: string) =>
                                subject.toLowerCase().includes(kw.toLowerCase()) ||
                                snippet.toLowerCase().includes(kw.toLowerCase())
                            );
                            if (kws.length > 0) matchedCriteria.push(`Palavras-chave: ${kws.join(', ')}`);
                        }
                        if (rule.condition === RuleCondition.ALWAYS && !hasSubjectReq && !hasSenderReq && !hasKeywordsReq) {
                            matchedCriteria.push("Sempre");
                        }

                        if (matchedCriteria.length > 0) {
                            // Rule Matched! Execute Actions
                            const actionsTaken: string[] = [];
                            let emailSent = false;
                            let whatsappSent = false;
                            const actionPromises = [];

                            if (rule.actions) {
                                if (rule.actions.markAsRead) {
                                    actionPromises.push(fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}/modify`, {
                                        method: 'POST',
                                        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
                                    }).then(() => actionsTaken.push("Marcado como lido")));
                                }
                                if (rule.actions.archive) {
                                    actionPromises.push(fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}/modify`, {
                                        method: 'POST',
                                        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ removeLabelIds: ['INBOX'] })
                                    }).then(() => actionsTaken.push("Arquivado")));
                                }
                                if (rule.actions.applyLabel) {
                                    actionPromises.push(fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}/modify`, {
                                        method: 'POST',
                                        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ addLabelIds: [rule.actions.applyLabel] })
                                    }).then(() => actionsTaken.push(`Label: ${rule.actions.applyLabel}`)));
                                }
                            }
                            await Promise.all(actionPromises);

                            // Email Notifications
                            const notificationEmails = rule.notification_emails || [];
                            if (notificationEmails.length > 0) {
                                const emailBody = `
                                    <h2>Regra Acionada: ${rule.name}</h2>
                                    <p>Uma nova mensagem correspondeu à sua regra no MailWatch (Processado em Segundo Plano).</p>
                                    <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #00E699; margin: 20px 0;">
                                        <p><strong>De:</strong> ${from}</p>
                                        <p><strong>Assunto:</strong> ${subject}</p>
                                        <p><strong>Prévia:</strong> ${snippet}</p>
                                        <p><strong>Critérios:</strong> ${matchedCriteria.join(', ')}</p>
                                    </div>
                                `;
                                const emailPromises = notificationEmails.map(async (recipientEmail) => {
                                    const rawMessage = [
                                        `From: me`,
                                        `To: ${recipientEmail}`,
                                        `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(`Alerta: Regra "${rule.name}" acionada`)))}?=`,
                                        'MIME-Version: 1.0',
                                        'Content-Type: text/html; charset=UTF-8',
                                        '',
                                        emailBody
                                    ].join('\r\n');
                                    const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage)))
                                        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

                                    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
                                        method: 'POST',
                                        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ raw: encodedMessage })
                                    });
                                    if (sendRes.ok) {
                                        emailSent = true;
                                        actionsTaken.push(`Email para ${recipientEmail}`);
                                    }
                                });
                                await Promise.all(emailPromises);
                            }

                            // WhatsApp Notifications
                            const whatsappNumbers = rule.whatsapp_numbers || [];
                            if (whatsappNumbers.length > 0) {
                                const { data: instance } = await supabase
                                    .from("whatsapp_instances")
                                    .select("instance_name")
                                    .eq("user_id", listUser.id)
                                    .single();

                                if (instance && evolutionUrl && evolutionKey) {
                                    // Use 'from' directly, but sometimes it has <email> which might be messy for WA.
                                    const wsMessage = `📢 *Alerta MailWatch (Background)*\n\n*Regra:* ${rule.name}\n*De:* ${from}\n*Assunto:* ${subject}\n*Prévia:* ${snippet}\n\n_Notificação enviada automaticamente_`;

                                    const waPromises = whatsappNumbers.map(async (whatsappNumber) => {
                                        const response = await fetch(`${evolutionUrl}/message/sendText/${instance.instance_name}`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
                                            body: JSON.stringify({
                                                number: whatsappNumber.replace(/\D/g, ''),
                                                text: wsMessage,
                                                linkPreview: false
                                            })
                                        });
                                        if (response.ok) {
                                            whatsappSent = true;
                                            actionsTaken.push(`WhatsApp para ${whatsappNumber}`);
                                        }
                                    });
                                    await Promise.all(waPromises);
                                }
                            }

                            // Log
                            const allRecipients = [
                                ...(rule.notification_emails || []),
                                ...(rule.whatsapp_numbers || []).map((n: string) => `WA:${n}`)
                            ].join(', ');

                            await supabase.from("notifications").insert({
                                status: (emailSent || whatsappSent) ? 'sent' : 'failed',
                                rule_name: rule.name,
                                recipient: allRecipients,
                                user_id: listUser.id
                            });

                            // Insert log for realtime frontend update
                            await supabase.from("logs").insert({
                                user_id: listUser.id,
                                type: 'RuleMatch',
                                title: `Regra "${rule.name}" aplicada`,
                                description: `Email de ${from.split('<')[0].trim()} - ${subject}`,
                                status: (emailSent || whatsappSent) ? 'success' : 'info',
                                details: actionsTaken.length > 0 ? actionsTaken.join(', ') : null
                            });

                            await supabase.from("processed_emails").insert({
                                user_id: listUser.id,
                                message_id: email.id,
                                rule_id: rule.id,
                                action_type: 'rule_execution_background'
                            });

                            results.push({ user: listUser.id, rule: rule.id, email: email.id, actions: actionsTaken });
                            log(`Matched Rule: ${rule.name}`);

                        } // end if matched
                    } // end rules loop
                } // end messages loop

            } catch (err: any) {
                log(`Error processing user: ${err.message}`);
            }
        } // end users loop

        return new Response(JSON.stringify({ success: true, processed: results, debug: debugLogs }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
