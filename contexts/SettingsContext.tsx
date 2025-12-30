import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language } from '../lib/translations';

interface AppSettings {
    checkInterval: number; // in milliseconds
    enableSounds: boolean;
    enableToasts: boolean;
    theme: 'dark' | 'light';
    language: Language;
}

const DEFAULT_SETTINGS: AppSettings = {
    checkInterval: 60000,
    enableSounds: true,
    enableToasts: true,
    theme: 'dark',
    language: 'pt-BR'
};

interface SettingsContextType {
    settings: AppSettings;
    updateSettings: (newSettings: Partial<AppSettings>) => void;
    t: (key: keyof typeof translations['pt-BR']) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<AppSettings>(() => {
        try {
            const stored = localStorage.getItem('mailwatch_settings');
            if (stored) {
                const parsed = JSON.parse(stored);
                // Ensure defaults for new fields
                return { ...DEFAULT_SETTINGS, ...parsed };
            }
            return DEFAULT_SETTINGS;
        } catch {
            return DEFAULT_SETTINGS;
        }
    });

    const updateSettings = (newSettings: Partial<AppSettings>) => {
        setSettings(prev => {
            const updated = { ...prev, ...newSettings };
            localStorage.setItem('mailwatch_settings', JSON.stringify(updated));
            return updated;
        });
    };

    const t = (key: keyof typeof translations['pt-BR']) => {
        const lang = settings.language || 'pt-BR';
        return translations[lang][key] || key;
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, t }}>
            {children}
        </SettingsContext.Provider>
    );
};
