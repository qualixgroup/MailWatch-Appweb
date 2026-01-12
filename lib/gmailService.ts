import { supabase } from './supabase';

export interface GmailConnection {
  connected: boolean;
  email?: string;
  provider?: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  labelIds: string[];
  isUnread: boolean;
}

export interface GmailFullMessage extends GmailMessage {
  body: string;
  htmlBody?: string;
  attachments: { filename: string; mimeType: string; size: number }[];
}

export const gmailService = {
  /**
   * Check if user is connected to Gmail (via Google OAuth login)
   */
  async getConnectionStatus(): Promise<GmailConnection> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { connected: false };

    // Check if user logged in with Google provider
    const googleIdentity = user.identities?.find(i => i.provider === 'google');

    if (googleIdentity) {
      return {
        connected: true,
        email: user.email,
        provider: 'google'
      };
    }

    return { connected: false };
  },

  /**
   * Get the Google access token from the current session
   */
  async getProviderToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.provider_token || null;
  },

  /**
   * Fetch emails from Gmail API
   */
  async fetchEmails(maxResults: number = 20): Promise<GmailMessage[]> {
    const token = await this.getProviderToken();

    if (!token) {
      console.error('No Google provider token available');
      return [];
    }

    try {
      // Fetch message list - only INBOX (received emails)
      const listResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!listResponse.ok) {
        const error = await listResponse.json();
        console.error('Gmail API error:', error);
        return [];
      }

      const listData = await listResponse.json();
      const messages = listData.messages || [];

      // Fetch details for each message
      const emailPromises = messages.map(async (msg: { id: string }) => {
        const detailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (!detailResponse.ok) return null;

        const detail = await detailResponse.json();
        const headers = detail.payload?.headers || [];

        const getHeader = (name: string) =>
          headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        return {
          id: detail.id,
          threadId: detail.threadId,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          to: getHeader('To'),
          date: getHeader('Date'),
          snippet: detail.snippet || '',
          labelIds: detail.labelIds || [],
          isUnread: detail.labelIds?.includes('UNREAD') || false
        } as GmailMessage;
      });

      const emails = await Promise.all(emailPromises);
      return emails.filter(e => e !== null) as GmailMessage[];

    } catch (error) {
      console.error('Error fetching emails:', error);
      return [];
    }
  },

  /**
   * Fetch emails with pagination support
   */
  async fetchEmailsWithPagination(maxResults: number = 20, pageToken?: string): Promise<{ emails: GmailMessage[]; nextPageToken?: string }> {
    const token = await this.getProviderToken();

    if (!token) {
      console.error('No Google provider token available');
      return { emails: [] };
    }

    try {
      // Build URL with optional pageToken - only INBOX
      let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`;
      if (pageToken) {
        url += `&pageToken=${pageToken}`;
      }

      const listResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!listResponse.ok) {
        const error = await listResponse.json();
        console.error('Gmail API error:', error);
        return { emails: [] };
      }

      const listData = await listResponse.json();
      const messages = listData.messages || [];
      const nextPageToken = listData.nextPageToken;

      // Fetch details for each message
      const emailPromises = messages.map(async (msg: { id: string }) => {
        const detailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (!detailResponse.ok) return null;

        const detail = await detailResponse.json();
        const headers = detail.payload?.headers || [];

        const getHeader = (name: string) =>
          headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        return {
          id: detail.id,
          threadId: detail.threadId,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          to: getHeader('To'),
          date: getHeader('Date'),
          snippet: detail.snippet || '',
          labelIds: detail.labelIds || [],
          isUnread: detail.labelIds?.includes('UNREAD') || false
        } as GmailMessage;
      });

      const emails = await Promise.all(emailPromises);
      return {
        emails: emails.filter(e => e !== null) as GmailMessage[],
        nextPageToken
      };

    } catch (error) {
      console.error('Error fetching emails:', error);
      return { emails: [] };
    }
  },

  /**
   * Mark an email as read
   */
  async markAsRead(messageId: string): Promise<boolean> {
    const token = await this.getProviderToken();
    if (!token) return false;

    try {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            removeLabelIds: ['UNREAD']
          })
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Error marking email as read:', error);
      return false;
    }
  },

  /**
   * Get email count (unread and total)
   */
  async getEmailStats(): Promise<{ total: number; unread: number }> {
    const token = await this.getProviderToken();
    if (!token) return { total: 0, unread: 0 };

    try {
      // Get INBOX label stats
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) return { total: 0, unread: 0 };

      const data = await response.json();
      return {
        total: data.messagesTotal || 0,
        unread: data.messagesUnread || 0
      };
    } catch (error) {
      console.error('Error fetching email stats:', error);
      return { total: 0, unread: 0 };
    }
  },

  /**
   * Fetch ALL emails from today (with pagination)
   */
  async fetchAllTodayEmails(): Promise<GmailMessage[]> {
    const token = await this.getProviderToken();
    if (!token) {
      console.error('No Google provider token available');
      return [];
    }

    try {
      const allEmails: GmailMessage[] = [];
      let pageToken: string | undefined;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Gmail date format: YYYY/MM/DD
      const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;

      // Fetch pages until no more
      do {
        let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&labelIds=INBOX&q=after:${dateStr}`;
        if (pageToken) {
          url += `&pageToken=${pageToken}`;
        }

        const listResponse = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!listResponse.ok) {
          console.error('Gmail API error fetching today emails:', await listResponse.json());
          break;
        }

        const listData = await listResponse.json();
        const messages = listData.messages || [];
        pageToken = listData.nextPageToken;

        // Fetch details for each message
        for (const msg of messages) {
          const detailResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );

          if (!detailResponse.ok) continue;

          const detail = await detailResponse.json();
          const headers = detail.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

          allEmails.push({
            id: detail.id,
            threadId: detail.threadId,
            subject: getHeader('Subject'),
            from: getHeader('From'),
            to: getHeader('To'),
            date: getHeader('Date'),
            snippet: detail.snippet || '',
            labelIds: detail.labelIds || [],
            isUnread: detail.labelIds?.includes('UNREAD') || false
          });
        }

        console.log(`Fetched ${allEmails.length} emails from today so far...`);

      } while (pageToken);

      console.log(`Total emails from today: ${allEmails.length}`);
      return allEmails;

    } catch (error) {
      console.error('Error fetching all today emails:', error);
      return [];
    }
  },

  /**
   * Get full email content including body
   */
  async getFullEmail(messageId: string): Promise<GmailFullMessage | null> {
    const token = await this.getProviderToken();
    if (!token) return null;

    try {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) return null;

      const data = await response.json();
      const headers = data.payload?.headers || [];

      const getHeader = (name: string) =>
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      // Extract body from parts
      let body = '';
      let htmlBody = '';
      const attachments: { filename: string; mimeType: string; size: number }[] = [];

      // Helper to decode Base64Url to UTF-8
      const decodeBase64 = (data: string) => {
        try {
          const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
          const binaryString = atob(base64);
          const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
          return new TextDecoder('utf-8').decode(bytes);
        } catch (e) {
          console.error('Error decoding base64:', e);
          return '';
        }
      };

      const extractBody = (part: any) => {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = decodeBase64(part.body.data);
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          htmlBody = decodeBase64(part.body.data);
        } else if (part.filename && part.body?.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size || 0
          });
        }

        if (part.parts) {
          part.parts.forEach(extractBody);
        }
      };

      if (data.payload) {
        extractBody(data.payload);
      }

      // If body is in the main payload
      if (!body && !htmlBody && data.payload?.body?.data) {
        const decodedBody = decodeBase64(data.payload.body.data);
        if (data.payload.mimeType === 'text/html') {
          htmlBody = decodedBody;
        } else {
          body = decodedBody;
        }
      }

      return {
        id: data.id,
        threadId: data.threadId,
        subject: getHeader('Subject'),
        from: getHeader('From'),
        to: getHeader('To'),
        date: getHeader('Date'),
        snippet: data.snippet || '',
        labelIds: data.labelIds || [],
        isUnread: data.labelIds?.includes('UNREAD') || false,
        body: body || htmlBody,
        htmlBody: htmlBody || undefined,
        attachments
      };
    } catch (error) {
      console.error('Error fetching full email:', error);
      return null;
    }
  },

  /**
   * Apply a label to an email
   */
  async applyLabel(messageId: string, labelId: string): Promise<boolean> {
    const token = await this.getProviderToken();
    if (!token) return false;

    try {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            addLabelIds: [labelId]
          })
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Error applying label:', error);
      return false;
    }
  },

  /**
   * Archive an email (remove from INBOX)
   */
  async archiveEmail(messageId: string): Promise<boolean> {
    const token = await this.getProviderToken();
    if (!token) return false;

    try {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            removeLabelIds: ['INBOX']
          })
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Error archiving email:', error);
      return false;
    }
  },

  /**
   * Move an email to Trash
   */
  async trashEmail(messageId: string): Promise<boolean> {
    const token = await this.getProviderToken();
    if (!token) return false;

    try {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Error trashing email:', error);
      return false;
    }
  },

  /**
   * Send an email using the user's Gmail account
   */
  async sendEmail(options: {
    to: string;
    subject: string;
    body: string;
    htmlBody?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const token = await this.getProviderToken();
    if (!token) {
      return { success: false, error: 'Token não disponível' };
    }

    try {
      // Get current user email for "From" field
      const { data: { user } } = await supabase.auth.getUser();
      const fromEmail = user?.email || 'me';

      // Create email content in RFC 2822 format
      const emailContent = options.htmlBody
        ? [
          `From: ${fromEmail}`,
          `To: ${options.to}`,
          `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(options.subject)))}?=`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=UTF-8',
          '',
          options.htmlBody
        ].join('\r\n')
        : [
          `From: ${fromEmail}`,
          `To: ${options.to}`,
          `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(options.subject)))}?=`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset=UTF-8',
          '',
          options.body
        ].join('\r\n');

      // Encode to base64url format
      const encodedMessage = btoa(unescape(encodeURIComponent(emailContent)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            raw: encodedMessage
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Gmail send error:', errorData);
        return {
          success: false,
          error: errorData.error?.message || 'Falha ao enviar email'
        };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message || 'Erro ao enviar email' };
    }
  },

  /**
   * Send a notification email about a matched rule
   */
  async sendRuleNotification(options: {
    to: string;
    ruleName: string;
    emailFrom: string;
    emailSubject: string;
    emailSnippet: string;
    matchedCriteria: string[];
  }): Promise<{ success: boolean; error?: string }> {
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #00E5A0 0%, #00B4D8 100%); padding: 20px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🔔 Regra Acionada: ${options.ruleName}</h1>
        </div>
        
        <div style="background: #1a1a2e; padding: 20px; color: #e0e0e0;">
          <p style="margin-bottom: 20px;">Uma nova mensagem correspondeu à sua regra no <strong>MailWatch</strong>.</p>
          
          <div style="background: #16213e; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #00E5A0;">
            <p style="margin: 5px 0;"><strong style="color: #00E5A0;">De:</strong> ${options.emailFrom}</p>
            <p style="margin: 5px 0;"><strong style="color: #00E5A0;">Assunto:</strong> ${options.emailSubject}</p>
            <p style="margin: 5px 0;"><strong style="color: #00E5A0;">Prévia:</strong> ${options.emailSnippet}</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <p style="margin-bottom: 10px;"><strong style="color: #00E5A0;">Critérios correspondidos:</strong></p>
            <ul style="margin: 0; padding-left: 20px;">
              ${options.matchedCriteria.map(c => `<li style="margin: 5px 0;">${c}</li>`).join('')}
            </ul>
          </div>
        </div>
        
        <div style="background: #0f0f23; padding: 15px; border-radius: 0 0 12px 12px; text-align: center;">
          <p style="color: #666; font-size: 12px; margin: 0;">
            Esta notificação foi enviada automaticamente pelo MailWatch
          </p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: options.to,
      subject: `[MailWatch] Regra "${options.ruleName}" acionada`,
      body: `Regra "${options.ruleName}" foi acionada!\n\nDe: ${options.emailFrom}\nAssunto: ${options.emailSubject}\n\nCritérios: ${options.matchedCriteria.join(', ')}`,
      htmlBody
    });
  },

  /**
   * Handle OAuth callback from Google
   */
  async handleCallback(code: string, state: string | null): Promise<{ success: boolean; error?: string; email?: string }> {
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;

      return {
        success: true,
        email: data.user?.email
      };
    } catch (err: any) {
      console.error('Error handling callback:', err);
      return { success: false, error: err.message };
    }
  }
};
