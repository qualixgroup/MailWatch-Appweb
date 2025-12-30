
import { supabase } from './supabase';
import { UserProfile } from '../types';

export const profileService = {
    async getProfile(): Promise<UserProfile | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        // Check if profile exists
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching profile:', error);
            return null;
        }

        // If profile doesn't exist (e.g. created before trigger), create it
        if (!data) {
            const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert([{ id: user.id, full_name: user.user_metadata.full_name, avatar_url: user.user_metadata.avatar_url }])
                .select()
                .single();

            if (createError) {
                console.error('Error creating profile:', createError);
                return null;
            }

            return {
                id: newProfile.id,
                fullName: newProfile.full_name || '',
                email: user.email || '',
                avatarUrl: newProfile.avatar_url,
                language: newProfile.language,
                timezone: newProfile.timezone,
                integrations: newProfile.integrations || { google: false, slack: false }
            };
        }

        return {
            id: data.id,
            fullName: data.full_name || '',
            email: user.email || '',
            avatarUrl: data.avatar_url,
            language: data.language,
            timezone: data.timezone,
            integrations: data.integrations || { google: false, slack: false }
        };
    },

    async updateProfile(updates: Partial<UserProfile>) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No user logged in');

        const profileUpdates: any = {
            updated_at: new Date().toISOString(),
        };

        if (updates.fullName !== undefined) profileUpdates.full_name = updates.fullName;
        if (updates.avatarUrl !== undefined) profileUpdates.avatar_url = updates.avatarUrl;
        if (updates.language !== undefined) profileUpdates.language = updates.language;
        if (updates.timezone !== undefined) profileUpdates.timezone = updates.timezone;
        if (updates.integrations !== undefined) profileUpdates.integrations = updates.integrations;

        const { error } = await supabase
            .from('profiles')
            .update(profileUpdates)
            .eq('id', user.id);

        if (error) {
            console.error('Error updating profile:', error);
            throw error;
        }
    },

    async toggleIntegration(integration: 'google' | 'slack', currentProfile: UserProfile) {
        const newIntegrations = {
            ...currentProfile.integrations,
            [integration]: !currentProfile.integrations[integration]
        };

        await this.updateProfile({ integrations: newIntegrations });
        return newIntegrations;
    }
};
