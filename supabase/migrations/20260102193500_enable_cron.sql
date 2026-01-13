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
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_E0WrKpuNbXBA3dTJm8DazQ__IlTB4Xq"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
  );
