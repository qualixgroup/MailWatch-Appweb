-- Create user_gmail_tokens table for reliable offline token storage
CREATE TABLE IF NOT EXISTS public.user_gmail_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    gmail_email TEXT NOT NULL,
    scopes TEXT[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_gmail_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.user_gmail_tokens;
DROP POLICY IF EXISTS "Users can insert/update their own tokens" ON public.user_gmail_tokens;

CREATE POLICY "Users can view their own tokens"
ON public.user_gmail_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert/update their own tokens"
ON public.user_gmail_tokens FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure processed_emails has proper RLS
ALTER TABLE public.processed_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own processed emails" ON public.processed_emails;
DROP POLICY IF EXISTS "Users can insert their own processed emails" ON public.processed_emails;

CREATE POLICY "Users can view their own processed emails"
ON public.processed_emails FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own processed emails"
ON public.processed_emails FOR INSERT
WITH CHECK (auth.uid() = user_id);
