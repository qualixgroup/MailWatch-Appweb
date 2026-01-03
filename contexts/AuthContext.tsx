
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

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                // DEBUG: Log to DB to verify token presence
                const hasRefreshToken = !!session?.provider_refresh_token;
                const hasAccessToken = !!session?.provider_token;

                if (session?.user) {
                    await supabase.from('logs').insert({
                        type: 'Debug',
                        title: 'Auth Check',
                        description: `Event: ${event}. Has RT: ${hasRefreshToken}. Has AT: ${hasAccessToken}`,
                        user_id: session.user.id,
                        status: hasRefreshToken ? 'success' : 'info'
                    });
                }

                // Persist Google Tokens if available
                if (session?.provider_refresh_token && session.user) {
                    console.log("Found provider refresh token, saving to DB...");
                    const { error } = await supabase
                        .from('user_gmail_tokens')
                        .upsert({
                            user_id: session.user.id,
                            access_token: session.provider_token,
                            refresh_token: session.provider_refresh_token,
                            expires_at: session.expires_at,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'user_id' });

                    if (error) {
                        console.error("Error saving tokens:", error);
                        await supabase.from('logs').insert({
                            type: 'Debug',
                            title: 'Token Save Error',
                            description: error.message,
                            user_id: session.user.id,
                            status: 'error'
                        });
                    } else {
                        await supabase.from('logs').insert({
                            type: 'Debug',
                            title: 'Token Saved',
                            description: 'Successfully saved provider tokens to custom table',
                            user_id: session.user.id,
                            status: 'success'
                        });
                    }
                }
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
