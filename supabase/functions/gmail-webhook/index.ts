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
        const payload = await req.json();

        // Gmail API Push Notifications structure:
        // { message: { data: "base64...", messageId: "..." }, subscription: "..." }
        if (!payload.message || !payload.message.data) {
            console.log("Invalid Pub/Sub payload format");
            return new Response(JSON.stringify({ error: "Invalid payload" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Decode payload
        const decodedData = atob(payload.message.data);
        const data = JSON.parse(decodedData);
        // Data format: { emailAddress: "user@gmail.com", historyId: 12345 }

        console.log(`Received push notification for: ${data.emailAddress}, historyId: ${data.historyId}`);

        if (!data.emailAddress) {
            return new Response(JSON.stringify({ error: "Missing emailAddress" }), {
                status: 200, // Acknowledge to stop Pub/Sub retries
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Initialize Supabase Admin Client
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Find user by Gmail address in our tokens table
        const { data: tokenData, error: tokenError } = await supabase
            .from("user_gmail_tokens")
            .select("user_id, refresh_token")
            .eq("gmail_email", data.emailAddress)
            .single();

        if (tokenError || !tokenData) {
            console.log(`User not found for email: ${data.emailAddress}`);
            // Acknowledge to prevent infinite retries if we don't know the user
            return new Response(JSON.stringify({ message: "User ignored" }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const userId = tokenData.user_id;

        // 2. Invoke process-rules function incrementally
        // We call the other function to reuse logic and keep things modular
        const { error: invokeError } = await supabase.functions.invoke('process-rules', {
            body: {
                mode: 'incremental',
                userId: userId,
                historyId: data.historyId, // Current historyId from notification
                emailAddress: data.emailAddress
            }
        });

        if (invokeError) {
            console.error(`Error invoking process-rules: ${invokeError.message}`);
            // Still return 200 to Pub/Sub so it doesn't retry this specific failed processing 
            // (or return 500 if you WANT it to retry)
            return new Response(JSON.stringify({ error: "Processing failed" }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 3. Update the latest historyId for this user
        // This helps us track where we are, though process-rules might also update it
        await supabase
            .from("user_gmail_tokens")
            .update({ history_id: String(data.historyId) })
            .eq("user_id", userId);

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error: any) {
        console.error(`Error processing webhook: ${error.message}`);
        // Return 200 to acknowledge receipt and prevent Pub/Sub from spamming retries for bad payloads
        return new Response(JSON.stringify({ error: error.message }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
