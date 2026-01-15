import { supabase } from './supabase';
import { RealtimeChannel, RealtimePostgresInsertPayload } from '@supabase/supabase-js';

export type RealtimeTable = 'logs' | 'notifications' | 'processed_emails';

interface RealtimeCallbacks {
    onLogsInsert?: (payload: RealtimePostgresInsertPayload<any>) => void;
    onNotificationsInsert?: (payload: RealtimePostgresInsertPayload<any>) => void;
    onProcessedEmailsInsert?: (payload: RealtimePostgresInsertPayload<any>) => void;
}

class RealtimeService {
    private channel: RealtimeChannel | null = null;
    private isConnected = false;
    private callbacks: RealtimeCallbacks = {};
    private listeners: ((connected: boolean) => void)[] = [];
    private currentUserId: string | null = null;

    /**
     * Subscribe to all relevant tables for real-time updates
     * Must be called with the authenticated user's ID for RLS filtering
     */
    async subscribeAll(userId: string, callbacks: RealtimeCallbacks): Promise<void> {
        // If already subscribed for this user, skip
        if (this.channel && this.currentUserId === userId) {
            console.log('[RealtimeService] Already subscribed for user:', userId);
            return;
        }

        // Cleanup any existing subscription
        if (this.channel) {
            console.log('[RealtimeService] Cleaning up previous subscription');
            await this.cleanup();
        }

        this.callbacks = callbacks;
        this.currentUserId = userId;

        console.log('[RealtimeService] Setting up real-time subscriptions for user:', userId);

        // Create channel with user-specific filter
        // The filter uses eq to only receive events for the current user
        this.channel = supabase
            .channel(`mailwatch-realtime-${userId}`)
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'logs',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    console.log('📋 [Realtime] New log received:', payload.new);
                    this.callbacks.onLogsInsert?.(payload);
                }
            )
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    console.log('🔔 [Realtime] New notification received:', payload.new);
                    this.callbacks.onNotificationsInsert?.(payload);
                }
            )
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'processed_emails',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    console.log('✉️ [Realtime] New processed email received:', payload.new);
                    this.callbacks.onProcessedEmailsInsert?.(payload);
                }
            )
            .subscribe((status, err) => {
                console.log('[RealtimeService] Subscription status:', status, err || '');
                this.isConnected = status === 'SUBSCRIBED';
                this.notifyListeners();

                if (status === 'SUBSCRIBED') {
                    console.log('🟢 [RealtimeService] Successfully subscribed to realtime updates');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ [RealtimeService] Channel error:', err);
                } else if (status === 'TIMED_OUT') {
                    console.error('⏱️ [RealtimeService] Subscription timed out');
                }
            });
    }

    /**
     * Cleanup all subscriptions
     */
    async cleanup(): Promise<void> {
        if (this.channel) {
            console.log('[RealtimeService] Cleaning up subscriptions...');
            await supabase.removeChannel(this.channel);
            this.channel = null;
            this.isConnected = false;
            this.callbacks = {};
            this.currentUserId = null;
            this.notifyListeners();
        }
    }

    /**
     * Check if connected to realtime
     */
    getConnectionStatus(): boolean {
        return this.isConnected;
    }

    /**
     * Get current subscribed user ID
     */
    getCurrentUserId(): string | null {
        return this.currentUserId;
    }

    /**
     * Subscribe to connection status changes
     */
    onConnectionChange(listener: (connected: boolean) => void): () => void {
        this.listeners.push(listener);
        // Immediately notify with current status
        listener(this.isConnected);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners(): void {
        this.listeners.forEach(listener => listener(this.isConnected));
    }
}

// Singleton instance
export const realtimeService = new RealtimeService();
