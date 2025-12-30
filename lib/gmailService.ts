import { supabase } from './supabase';

export interface GmailConnection {
  connected: boolean;
  email?: string;
  expiresAt?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const gmailService = {
  /**
   * Check if user has Gmail connected and get connection details
   */
  async getConnectionStatus(): Promise<GmailConnection> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { connected: false };

    const { data, error } = await supabase
      .from('user_gmail_tokens')
      .select('gmail_email, token_expires_at')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return { connected: false };
    }

    return {
      connected: true,
      email: data.gmail_email,
      expiresAt: data.token_expires_at
    };
  },

  /**
   * Initiate OAuth flow - returns URL to redirect user to Google
   */
  async initiateOAuth(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(`${SUPABASE_URL}/functions/v1/gmail-oauth-init`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    // Store state in sessionStorage for verification on callback
    if (data.state) {
      sessionStorage.setItem('gmail_oauth_state', data.state);
    }

    return data.authUrl;
  },

  /**
   * Handle OAuth callback - exchange code for tokens
   */
  async handleCallback(code: string, state: string): Promise<{ success: boolean; email?: string; error?: string }> {
    // Verify state matches what we stored
    const storedState = sessionStorage.getItem('gmail_oauth_state');
    if (storedState !== state) {
      return { success: false, error: 'Invalid state parameter' };
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/gmail-oauth-callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code, state })
    });

    const data = await response.json();

    // Clean up stored state
    sessionStorage.removeItem('gmail_oauth_state');

    if (data.error) {
      return { success: false, error: data.error };
    }

    return { success: true, email: data.email };
  },

  /**
   * Disconnect Gmail - revoke tokens and remove integration
   */
  async disconnect(): Promise<{ success: boolean; error?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(`${SUPABASE_URL}/functions/v1/gmail-disconnect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error };
    }

    return { success: true };
  }
};
