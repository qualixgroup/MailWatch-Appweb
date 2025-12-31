
import axios from 'axios';

const API_URL = import.meta.env.VITE_EVOLUTION_API_URL;
const API_KEY = import.meta.env.VITE_EVOLUTION_API_KEY;

// Interfaces based on Evolution API v2 responses
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
    qrcode: {
        instanceName: string;
        pairingCode: string;
        code: string; // Base64
        base64: string;
    }
}

export const whatsappService = {
    // Check if configuration is present
    isConfigured(): boolean {
        return !!API_URL && !!API_KEY;
    },

    // Get all instances (to check if user has one)
    async fetchInstances(): Promise<string[]> { // Returns array of instance names
        if (!this.isConfigured()) return [];
        try {
            const response = await axios.get(`${API_URL}/instance/fetchInstances`, {
                headers: { 'apikey': API_KEY }
            });
            return response.data.map((item: any) => item.instance.instanceName);
        } catch (error) {
            console.error('Error fetching instances:', error);
            return [];
        }
    },

    // Create a new instance for the user
    async createInstance(instanceName: string): Promise<WhatsAppInstance | null> {
        if (!this.isConfigured()) throw new Error('Evolution API not configured');
        try {
            const response = await axios.post(`${API_URL}/instance/create`, {
                instanceName: instanceName,
                qrcode: true,
                integration: "WHATSAPP-BAILEYS"
            }, {
                headers: {
                    'apikey': API_KEY,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error creating instance:', error);
            throw error;
        }
    },

    // Connect instance (Get QR Code)
    async connectInstance(instanceName: string): Promise<QRCodeResponse | null> {
        if (!this.isConfigured()) return null;
        try {
            // Usually returns the base64 QR code
            const response = await axios.get(`${API_URL}/instance/connect/${instanceName}`, {
                headers: { 'apikey': API_KEY }
            });
            return response.data;
        } catch (error) {
            console.error('Error connecting instance:', error);
            throw error;
        }
    },

    // Get connection state
    async getConnectionState(instanceName: string): Promise<ConnectionState | null> {
        if (!this.isConfigured()) return null;
        try {
            const response = await axios.get(`${API_URL}/instance/connectionState/${instanceName}`, {
                headers: { 'apikey': API_KEY }
            });
            return response.data;
        } catch (error) {
            console.error('Error getting connection state:', error);
            return null;
        }
    },

    // Logout/Disconnect
    async logoutInstance(instanceName: string): Promise<void> {
        if (!this.isConfigured()) return;
        try {
            await axios.delete(`${API_URL}/instance/logout/${instanceName}`, {
                headers: { 'apikey': API_KEY }
            });
        } catch (error) {
            console.error('Error logging out instance:', error);
            throw error;
        }
    },

    // Delete Instance (Optional cleanup)
    async deleteInstance(instanceName: string): Promise<void> {
        if (!this.isConfigured()) return;
        try {
            await axios.delete(`${API_URL}/instance/delete/${instanceName}`, {
                headers: { 'apikey': API_KEY }
            });
        } catch (error) {
            console.error('Error deleting instance:', error);
            throw error;
        }
    }
};
