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
      // Fetch message list
      const listResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
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
      // Build URL with optional pageToken
      let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
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

      const extractBody = (part: any) => {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          htmlBody = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
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
        const decodedBody = atob(data.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
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
  }
};
