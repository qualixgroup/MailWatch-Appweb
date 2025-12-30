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
  }
};
