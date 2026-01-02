
import { supabase } from './supabase';

// Helper to call our Supabase proxy
async function proxyRequest(path: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', body?: any) {
    // Get current session to pass the access token
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
    }

    const { data, error } = await supabase.functions.invoke('evolution-proxy', {
        body: { path, method, body },
        headers: {
            Authorization: `Bearer ${session.access_token}`
        }
    });

    if (error) {
        console.error(`Proxy request error (${path}):`, error);
        throw error;
    }

    return data;
}

export interface WhatsAppInstance {
    instance: {
        instanceName: string;
        instanceId: string;
        status: string;
    };
    hash: {
        apikey: string;
    };
}

export interface ConnectionState {
    instance: {
        instanceName: string;
        state: 'open' | 'connecting' | 'close';
    };
}

export interface QRCodeResponse {
    qrcode?: {
        instanceName?: string;
        pairingCode?: string;
        code?: string; // Base64
        base64?: string;
    };
    base64?: string;
    code?: string;
    pairingCode?: string;
}

export const whatsappService = {
    // Get all instances
    async fetchInstances(): Promise<string[]> {
        try {
            const data = await proxyRequest('/instance/fetchInstances');
            return data.map((item: any) => item.instance.instanceName);
        } catch (error) {
            console.error('Error fetching instances:', error);
            return [];
        }
    },

    // Create a new instance
    async createInstance(instanceName: string): Promise<WhatsAppInstance | null> {
        try {
            return await proxyRequest('/instance/create', 'POST', {
                instanceName: instanceName,
                qrcode: true,
                integration: "WHATSAPP-BAILEYS"
            });
        } catch (error) {
            console.error('Error creating instance:', error);
            throw error;
        }
    },

    // Connect instance (Get QR Code)
    async connectInstance(instanceName: string): Promise<QRCodeResponse | null> {
        try {
            return await proxyRequest(`/instance/connect/${instanceName}`);
        } catch (error) {
            console.error('Error connecting instance:', error);
            throw error;
        }
    },

    // Get connection state
    async getConnectionState(instanceName: string): Promise<ConnectionState | null> {
        try {
            return await proxyRequest(`/instance/connectionState/${instanceName}`);
        } catch (error) {
            console.error('Error getting connection state:', error);
            return null;
        }
    },

    // Logout/Disconnect
    async logoutInstance(instanceName: string): Promise<void> {
        try {
            await proxyRequest(`/instance/logout/${instanceName}`, 'DELETE');
        } catch (error) {
            console.error('Error logging out instance:', error);
            throw error;
        }
    },

    // Delete Instance
    async deleteInstance(instanceName: string): Promise<void> {
        try {
            await proxyRequest(`/instance/delete/${instanceName}`, 'DELETE');
        } catch (error) {
            console.error('Error deleting instance:', error);
            throw error;
        }
    },

    // Send Message
    async sendTextMessage(instanceName: string, number: string, text: string): Promise<any> {
        try {
            return await proxyRequest(`/message/sendText/${instanceName}`, 'POST', {
                number: number.replace(/\D/g, ''), // Cleanup number
                text: text,
                linkPreview: false
            });
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }
};
