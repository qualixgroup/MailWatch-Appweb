-- Ensure table exists
CREATE TABLE IF NOT EXISTS public.user_gmail_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    expires_at BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT unique_user_token UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.user_gmail_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies (drop first to avoid conflicts if doing multiple runs/edits)
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.user_gmail_tokens;
DROP POLICY IF EXISTS "Users can insert/update their own tokens" ON public.user_gmail_tokens;

CREATE POLICY "Users can view their own tokens"
ON public.user_gmail_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert/update their own tokens"
ON public.user_gmail_tokens FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Check if processed_emails has RLS policies too (good practice)
ALTER TABLE public.processed_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own processed emails" ON public.processed_emails;
CREATE POLICY "Users can view their own processed emails"
ON public.processed_emails FOR SELECT
USING (auth.uid() = user_id);
-- (Insert policy usually needed for client logic if client does inserts, but here mostly server does. 
-- However, if we move logic to client, we might need it. Adding for safety)
DROP POLICY IF EXISTS "Users can insert their own processed emails" ON public.processed_emails;
CREATE POLICY "Users can insert their own processed emails"
ON public.processed_emails FOR INSERT
WITH CHECK (auth.uid() = user_id);
