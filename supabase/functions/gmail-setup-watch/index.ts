import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { userId } = await req.json();

        if (!userId) {
            return new Response(JSON.stringify({ error: "Missing userId" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
        const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";

        // Topic Name from env or hardcoded based on previous steps
        const topicName = "projects/appautomacaopetronect/topics/mailwatch-gmail-notifications";

        if (!googleClientId || !googleClientSecret) {
            throw new Error("Missing Google Client ID/Secret env vars");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Get User's Refresh Token
        const { data: tokenRecord, error: tokenError } = await supabase
            .from('user_gmail_tokens')
            .select('refresh_token')
            .eq('user_id', userId)
            .single();

        let refreshToken = tokenRecord?.refresh_token;

        if (!refreshToken) {
            // Fallback to identity data if not in tokens table yet
            const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
            if (userError || !user) throw new Error("User not found");

            const googleIdentity = user.identities?.find((id) => id.provider === "google");
            if (googleIdentity?.identity_data?.provider_refresh_token) {
                refreshToken = googleIdentity.identity_data.provider_refresh_token;
            }
        }

        if (!refreshToken) {
            return new Response(JSON.stringify({ error: "No refresh token found for user" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 2. Refresh Access Token
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: googleClientId,
                client_secret: googleClientSecret,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
            }),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            throw new Error(`Failed to refresh token: ${errorText}`);
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // 3. Call Gmail watch()
        const watchResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/watch", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                topicName: topicName,
                labelIds: ["INBOX"],
                labelFilterAction: "include"
            })
        });

        if (!watchResponse.ok) {
            const errorText = await watchResponse.text();
            throw new Error(`Failed to set up Gmail watch: ${errorText}`);
        }

        const watchData = await watchResponse.json();
        // watchData = { historyId: "12345", expiration: "123456789" }

        const historyId = watchData.historyId;
        const expiration = new Date(Number(watchData.expiration)).toISOString();

        // 4. Update Database
        const { error: updateError } = await supabase
            .from("user_gmail_tokens")
            .update({
                history_id: String(historyId),
                watch_expiration: expiration,
                updated_at: new Date().toISOString()
            })
            .eq("user_id", userId);

        if (updateError) {
            console.error("Error updating tokens table:", updateError);
        }

        return new Response(JSON.stringify({
            success: true,
            historyId,
            expiration
        }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error: any) {
        console.error(`Error setting up watch: ${error.message}`);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
