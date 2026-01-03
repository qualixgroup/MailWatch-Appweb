import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Interfaces (Ported from types.ts) ---
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
    keywords?: string[]; // Array of strings or objects depending on DB json structure
    condition: RuleCondition;
    notificationEmail: string;
    whatsappNumber?: string;
    status: string;
    actions?: {
        markAsRead?: boolean;
        archive?: boolean;
        applyLabel?: string;
    };
}

// --- Helper Functions ---

/**
 * Checks if a string matches a filter based on the condition
 */
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

/**
 * Decodes Base64Url to UTF-8
 */
function decodeBase64(data: string): string {
    try {
        const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
        const binaryString = atob(base64);
        /* @ts-ignore */
        const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
        return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
        return '';
    }
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Initialize Supabase Admin Client
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
        const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";

        // Optional: Evolution API for WhatsApp
        const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
        const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

        if (!googleClientId || !googleClientSecret) {
            throw new Error("Missing Google Client ID/Secret env vars");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. List all users (TODO: Pagination for scale)
        const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
        if (usersError) throw usersError;

        const results = [];

        const debugLogs: string[] = [];

        // 2. Process each user
        // 2. Process each user
        for (const listUser of users) {
            // Fetch full user details to get identities
            const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(listUser.id);

            if (userError || !user) {
                console.log(`[User ${listUser.id}] Failed to fetch full details: ${userError?.message}`);
                continue;
            }

            const log = (msg: string) => {
                console.log(`[User ${user.id}] ${msg}`);
                debugLogs.push(`[User ${user.id}] ${msg}`);
            };

            try {

                // Retrieve Refresh Token
                // Strategy 1: Check user_gmail_tokens table (Preferred)
                let refreshToken: string | undefined;

                const { data: tokenRecord } = await supabase
                    .from('user_gmail_tokens')
                    .select('refresh_token')
                    .eq('user_id', listUser.id)
                    .single();

                if (tokenRecord?.refresh_token) {
                    refreshToken = tokenRecord.refresh_token;
                    log(`Found refresh token in user_gmail_tokens table`);
                } else {
                    // Strategy 2: Fallback to identities
                    const googleIdentity = user.identities?.find((id) => id.provider === "google");
                    if (googleIdentity?.identity_data?.provider_refresh_token) {
                        refreshToken = googleIdentity.identity_data.provider_refresh_token;
                        log(`Found refresh token in identity_data`);
                    }
                }

                if (!refreshToken) {
                    log(`No refresh token found (checked DB table and identity_data).`);
                    continue;
                }

                // 3. Refresh Google Token
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
                    const errorText = await tokenResponse.text();
                    log(`Failed to refresh token. Status: ${tokenResponse.status}, Error: ${errorText}`);
                    continue;
                }

                const tokenData = await tokenResponse.json();
                const accessToken = tokenData.access_token;
                log(`Successfully refreshed token`);

                // 4. Fetch Active Rules for User
                const { data: rules } = await supabase
                    .from("rules")
                    .select("*")
                    .eq("user_id", user.id)
                    .eq("status", "active");

                if (!rules || rules.length === 0) {
                    log(`No active rules found`);
                    continue;
                }

                // 5. Fetch Recent Emails (Last 20 Unread in INBOX)
                const gmailResponse = await fetch(
                    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=INBOX&q=is:unread category:primary",
                    {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    }
                );

                if (!gmailResponse.ok) {
                    log(`Failed to fetch gmail messages: ${gmailResponse.status}`);
                    continue;
                }

                const gmailData = await gmailResponse.json();
                const messages = gmailData.messages || [];
                log(`Found ${messages.length} messages`);

                // 6. Process Emails against Rules
                for (const metaMsg of messages) {
                    // Fetch full message details to get headers and snippet
                    const msgRes = await fetch(
                        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${metaMsg.id}?format=full`,
                        { headers: { Authorization: `Bearer ${accessToken}` } }
                    );

                    if (!msgRes.ok) continue;
                    const email = await msgRes.json();

                    // Extract headers
                    const headers = email.payload?.headers || [];
                    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

                    const subject = getHeader('subject');
                    const from = getHeader('from');
                    const snippet = email.snippet || "";

                    // Check each rule
                    for (const rule of rules) {
                        // Deduplication Check
                        const { data: existing } = await supabase
                            .from("processed_emails")
                            .select("id")
                            .eq("message_id", email.id)
                            .eq("rule_id", rule.id)
                            .limit(1)
                            .single();

                        if (existing) continue;

                        // Rule Matching Logic
                        const matches: string[] = [];

                        // Subject Filter
                        if (rule.subjectFilter) {
                            if (checkMatch(subject, rule.subjectFilter, rule.condition)) {
                                matches.push(`Assunto (${rule.condition}): ${rule.subjectFilter}`);
                            }
                        } else if (rule.condition === RuleCondition.ALWAYS) {
                            matches.push("Sempre");
                        }

                        // Sender Filter
                        if (rule.senderFilter) {
                            if (from.toLowerCase().includes(rule.senderFilter.toLowerCase())) {
                                matches.push(`Remetente: ${rule.senderFilter}`);
                            }
                        }

                        // Keywords Filter
                        if (rule.keywords && Array.isArray(rule.keywords) && rule.keywords.length > 0) {
                            const matchedKws = rule.keywords.filter((kw: string) =>
                                subject.toLowerCase().includes(kw.toLowerCase()) ||
                                snippet.toLowerCase().includes(kw.toLowerCase())
                            );
                            if (matchedKws.length > 0) {
                                matches.push(`Palavras-chave: ${matchedKws.join(', ')}`);
                            }
                        }

                        // Determine if rule matches
                        // Logic: If specific filters exist, they must be met.
                        // If subject/sender/keywords are all empty but condition is ALWAYS, it matches.
                        // If rule defines subjectFilter, it must match.
                        // If rule defines senderFilter, it must match.
                        // (This implies AND logic between defined filters, similar to typical email rules)

                        let isMatch = false;

                        // Simplified matching strategy:
                        // 1. If 'subjectFilter' is present, it MUST match.
                        // 2. If 'senderFilter' is present, it MUST match.
                        // 3. If 'keywords' are present, AT LEAST ONE must match.
                        // 4. If condition is ALWAYS, base match is true (but other filters still apply if present?)
                        //    Usually ALWAYS means "Apply to all incoming emails".

                        const hasSubjectReq = !!rule.subjectFilter;
                        const hasSenderReq = !!rule.senderFilter;
                        const hasKeywordsReq = rule.keywords && rule.keywords.length > 0;

                        const subjectMatches = hasSubjectReq ? checkMatch(subject, rule.subjectFilter, rule.condition) : true;
                        const senderMatches = hasSenderReq ? from.toLowerCase().includes(rule.senderFilter.toLowerCase()) : true;

                        let keywordsMatches = true;
                        if (hasKeywordsReq) {
                            keywordsMatches = rule.keywords.some((kw: string) =>
                                subject.toLowerCase().includes(kw.toLowerCase()) ||
                                snippet.toLowerCase().includes(kw.toLowerCase())
                            );
                        }

                        // If it's an "ALWAYS" rule with no other filters, it matches everything
                        if (rule.condition === RuleCondition.ALWAYS && !hasSubjectReq && !hasSenderReq && !hasKeywordsReq) {
                            isMatch = true;
                        } else {
                            // Otherwise, all *defined* criteria must match
                            // (If a user sets Subject AND Sender, usually they want BOTH)
                            // Note: This logic should align with the frontend ruleEngine.
                            // Examining ruleEngine.ts:
                            // It pushes to 'criteria' if matches.
                            // Then `const matches = criteria.length > 0;` which implies OR or partial match logic? 
                            // Re-reading ruleEngine.ts:
                            // It does unrelated checks. 
                            // if (subjectFilter) { check... if match push criteria }
                            // if (senderFilter) { check... if match push criteria }
                            // if (keywords) { check... if match push criteria }
                            // returns matches = criteria.length > 0.
                            // This means OR logic implicitly for the top level blocks? 
                            // NO, wait. If I set Subject "A" and Sender "B".
                            // If Subject matches, criteria has 1 item.
                            // If Sender doesn't match, criteria has 1 item.
                            // matches is true.
                            // So it is OR logic between the distinct blocks in the original code?
                            // "Rule matches if any criteria was met" -> Yes, it seems so.

                            // Let's replicate this "Any Criteria Met" logic for parity.

                            const matchedCriteria: string[] = [];

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

                            if (rule.condition === RuleCondition.ALWAYS) {
                                matchedCriteria.push("Sempre");
                            }

                            if (matchedCriteria.length > 0) {
                                isMatch = true;
                                matches.push(...matchedCriteria);
                            }
                        }

                        if (isMatch) {
                            // --- EXECUTE ACTIONS ---
                            const actionsTaken: string[] = [];
                            let emailSent = false;
                            let whatsappSent = false;
                            let actionError = null;

                            // 1. Gmail Actions
                            if (rule.actions) {
                                // Mark as Read
                                if (rule.actions.markAsRead) {
                                    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}/modify`, {
                                        method: 'POST',
                                        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
                                    });
                                    actionsTaken.push("Marcado como lido");
                                }
                                // Archive
                                if (rule.actions.archive) {
                                    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}/modify`, {
                                        method: 'POST',
                                        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ removeLabelIds: ['INBOX'] })
                                    });
                                    actionsTaken.push("Arquivado");
                                }
                                // Apply Label
                                if (rule.actions.applyLabel) {
                                    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}/modify`, {
                                        method: 'POST',
                                        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ addLabelIds: [rule.actions.applyLabel] })
                                    });
                                    actionsTaken.push(`Label: ${rule.actions.applyLabel}`);
                                }
                            }

                            // 2. Email Notification
                            if (rule.notificationEmail) {
                                const emailBody = `
                                    <h2>Regra Acionada: ${rule.name}</h2>
                                    <p>Uma nova mensagem correspondeu à sua regra no MailWatch (Processado em Segundo Plano).</p>
                                    <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #00E699; margin: 20px 0;">
                                        <p><strong>De:</strong> ${from}</p>
                                        <p><strong>Assunto:</strong> ${subject}</p>
                                        <p><strong>Prévia:</strong> ${snippet}</p>
                                        <p><strong>Critérios:</strong> ${matches.join(', ')}</p>
                                    </div>
                                `;

                                const rawMessage = [
                                    `From: me`,
                                    `To: ${rule.notificationEmail}`,
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
                                    actionsTaken.push(`Email para ${rule.notificationEmail}`);
                                } else {
                                    console.error("Failed to send notification email");
                                }
                            }

                            // 3. WhatsApp Notification
                            if (rule.whatsappNumber) {
                                const { data: instance } = await supabase
                                    .from("whatsapp_instances")
                                    .select("instance_name")
                                    .eq("user_id", user.id)
                                    .single();

                                if (instance && evolutionUrl && evolutionKey) {
                                    const wsMessage = `📢 *Alerta MailWatch (Background)*\n\n*Regra:* ${rule.name}\n*De:* ${from}\n*Assunto:* ${subject}\n*Prévia:* ${snippet}\n\n_Notificação enviada automaticamente_`;

                                    await fetch(`${evolutionUrl}/message/sendText/${instance.instance_name}`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'apikey': evolutionKey
                                        },
                                        body: JSON.stringify({
                                            number: rule.whatsappNumber.replace(/\D/g, ''),
                                            text: wsMessage,
                                            linkPreview: false
                                        })
                                    });
                                    whatsappSent = true;
                                    actionsTaken.push(`WhatsApp para ${rule.whatsappNumber}`);
                                }
                            }

                            // 4. Log Result
                            await supabase.from("notification_history").insert({
                                status: (emailSent || whatsappSent) ? 'sent' : 'failed',
                                rule_name: rule.name, // Note: DB column might be snake_case
                                recipient: [rule.notificationEmail, rule.whatsappNumber].filter(Boolean).join(', '),
                                error: actionError,
                                user_id: user.id
                            });

                            // Note: 'notification_history' schema check? 
                            // Based on types.ts, it has camelCase fields in interface? 
                            // Usually Supabase uses snake_case in DB and mapping in client.
                            // I'll assume standard snake_case for DB columns based on 'processed_emails'.
                            // If this fails, user will see error in logs.

                            // Mark as processed
                            await supabase.from("processed_emails").insert({
                                user_id: user.id,
                                message_id: email.id,
                                rule_id: rule.id,
                                action_type: 'rule_execution_background'
                            });

                            results.push({ user: user.id, rule: rule.id, email: email.id, actions: actionsTaken });
                            log(`Rule matched: ${rule.name} - Actions: ${actionsTaken.join(', ')}`);
                        }
                    }
                }

            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`Error processing user ${user.id}:`, err);
                log(`Error: ${msg}`);
            }
        }

        return new Response(JSON.stringify({ success: true, processed: results, debug: debugLogs }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});

