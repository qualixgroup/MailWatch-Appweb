import { gmailService, GmailMessage } from './gmailService';
import { ruleEngine } from './ruleEngine';

// Key for storing processed email IDs in localStorage
const PROCESSED_EMAILS_KEY = 'mailwatch_processed_emails';
const LAST_CHECK_KEY = 'mailwatch_last_check';
const MAX_STORED_IDS = 500; // Maximum number of processed IDs to store

interface MonitorState {
    isRunning: boolean;
    lastCheck: Date | null;
    processedCount: number;
    errors: string[];
}

class EmailMonitor {
    private intervalId: number | null = null;
    private state: MonitorState = {
        isRunning: false,
        lastCheck: null,
        processedCount: 0,
        errors: []
    };
    private listeners: ((state: MonitorState) => void)[] = [];

    // Default: check every 60 seconds (respects API quotas)
    private checkIntervalMs = 60000;

    /**
     * Get processed email IDs from localStorage
     */
    private getProcessedIds(): Set<string> {
        try {
            const stored = localStorage.getItem(PROCESSED_EMAILS_KEY);
            if (stored) {
                return new Set(JSON.parse(stored));
            }
        } catch (e) {
            console.error('Error reading processed IDs:', e);
        }
        return new Set();
    }

    /**
     * Save processed email IDs to localStorage
     */
    private saveProcessedIds(ids: Set<string>): void {
        try {
            // Keep only the most recent IDs to avoid memory issues
            const idsArray = Array.from(ids);
            const trimmedIds = idsArray.slice(-MAX_STORED_IDS);
            localStorage.setItem(PROCESSED_EMAILS_KEY, JSON.stringify(trimmedIds));
        } catch (e) {
            console.error('Error saving processed IDs:', e);
        }
    }

    /**
     * Mark emails as processed
     */
    private markAsProcessed(emails: GmailMessage[]): void {
        const processedIds = this.getProcessedIds();
        emails.forEach(email => processedIds.add(email.id));
        this.saveProcessedIds(processedIds);
    }

    /**
     * Filter out already processed emails
     */
    private getUnprocessedEmails(emails: GmailMessage[]): GmailMessage[] {
        const processedIds = this.getProcessedIds();
        return emails.filter(email => !processedIds.has(email.id));
    }

    /**
     * Check for new emails and apply rules
     */
    async checkAndProcess(): Promise<{ processed: number; matched: number }> {
        try {
            // Check connection first
            const connection = await gmailService.getConnectionStatus();
            if (!connection.connected) {
                return { processed: 0, matched: 0 };
            }

            // Fetch recent emails (only 20 to minimize API usage)
            const result = await gmailService.fetchEmailsWithPagination(20);
            const emails = result.emails;

            if (emails.length === 0) {
                return { processed: 0, matched: 0 };
            }

            // Filter to only unprocessed emails
            const unprocessedEmails = this.getUnprocessedEmails(emails);

            if (unprocessedEmails.length === 0) {
                // No new emails, just update last check time
                this.state.lastCheck = new Date();
                localStorage.setItem(LAST_CHECK_KEY, this.state.lastCheck.toISOString());
                this.notifyListeners();
                return { processed: 0, matched: 0 };
            }

            console.log(`[EmailMonitor] Found ${unprocessedEmails.length} new email(s) to process`);

            // Process emails against rules
            const matches = await ruleEngine.processEmails(unprocessedEmails);

            // Mark all fetched emails as processed (even if no rules matched)
            this.markAsProcessed(emails);

            // Update state
            this.state.lastCheck = new Date();
            this.state.processedCount += unprocessedEmails.length;
            localStorage.setItem(LAST_CHECK_KEY, this.state.lastCheck.toISOString());
            this.notifyListeners();

            if (matches.length > 0) {
                console.log(`[EmailMonitor] ${matches.length} rule(s) matched and applied`);
            }

            return { processed: unprocessedEmails.length, matched: matches.length };

        } catch (error: any) {
            console.error('[EmailMonitor] Error:', error);
            this.state.errors.push(error.message || 'Unknown error');
            // Keep only last 5 errors
            if (this.state.errors.length > 5) {
                this.state.errors = this.state.errors.slice(-5);
            }
            this.notifyListeners();
            return { processed: 0, matched: 0 };
        }
    }

    /**
     * Start automatic monitoring
     */
    start(intervalMs?: number): void {
        if (this.intervalId) {
            console.log('[EmailMonitor] Already running');
            return;
        }

        if (intervalMs) {
            this.checkIntervalMs = intervalMs;
        }

        console.log(`[EmailMonitor] Starting with ${this.checkIntervalMs / 1000}s interval`);

        // Run immediately on start
        this.checkAndProcess();

        // Then run at interval
        this.intervalId = window.setInterval(() => {
            this.checkAndProcess();
        }, this.checkIntervalMs);

        this.state.isRunning = true;
        this.notifyListeners();
    }

    /**
     * Stop automatic monitoring
     */
    stop(): void {
        if (this.intervalId) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
            this.state.isRunning = false;
            this.notifyListeners();
            console.log('[EmailMonitor] Stopped');
        }
    }

    /**
     * Get current state
     */
    getState(): MonitorState {
        return { ...this.state };
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener: (state: MonitorState) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Notify all listeners of state change
     */
    private notifyListeners(): void {
        this.listeners.forEach(listener => listener(this.getState()));
    }

    /**
     * Clear all processed email IDs (for testing/debugging)
     */
    clearProcessedIds(): void {
        localStorage.removeItem(PROCESSED_EMAILS_KEY);
        this.state.processedCount = 0;
        this.notifyListeners();
    }

    /**
     * Set check interval (in milliseconds)
     */
    setInterval(intervalMs: number): void {
        this.checkIntervalMs = Math.max(30000, intervalMs); // Minimum 30 seconds
        if (this.state.isRunning) {
            this.stop();
            this.start();
        }
    }
}

// Singleton instance
export const emailMonitor = new EmailMonitor();
