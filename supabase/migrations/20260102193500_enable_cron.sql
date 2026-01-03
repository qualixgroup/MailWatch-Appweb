-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Create the cron job
select
  cron.schedule(
    'process-rules-every-10-min', -- name of the cron job
    '*/10 * * * *',              -- every 10 minutes
    $$
    select
      net.http_post(
          url:='https://aizjveevorxzrfhglfxb.supabase.co/functions/v1/process-rules',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpemp2ZWV2b3J4enJmaGdsZnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMDA3NDgsImV4cCI6MjA4MjY3Njc0OH0.gEd_-aaz5E-OvHS0tqMly-1HtdBOYz1wOLtaokCL0ek"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
  );
