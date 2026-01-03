
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    loading: true,
    signOut: async () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check active sessions and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for changes on auth state (logged in, signed out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);

            // Only save token on SIGNED_IN to avoid loops
            if (event === 'SIGNED_IN' && session?.provider_refresh_token && session.user) {
                // Calculate token expiration timestamp (session.expires_at is Unix timestamp)
                const tokenExpiresAt = session.expires_at
                    ? new Date(session.expires_at * 1000).toISOString()
                    : new Date(Date.now() + 3600 * 1000).toISOString(); // Default 1 hour

                // Gmail scopes we're requesting
                const scopes = [
                    'https://www.googleapis.com/auth/gmail.readonly',
                    'https://www.googleapis.com/auth/gmail.modify',
                    'https://www.googleapis.com/auth/gmail.send'
                ];

                // Fire and forget - don't await to avoid blocking UI
                supabase
                    .from('user_gmail_tokens')
                    .upsert({
                        user_id: session.user.id,
                        access_token: session.provider_token,
                        refresh_token: session.provider_refresh_token,
                        token_expires_at: tokenExpiresAt,
                        gmail_email: session.user.email,
                        scopes: scopes,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id' })
                    .then(({ error }) => {
                        if (error) console.error("Error saving tokens:", error);
                        else console.log("Tokens saved successfully");
                    });
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const value = {
        session,
        user,
        loading,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    return useContext(AuthContext);
};
