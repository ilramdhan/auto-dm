-- Same as 0001_enable_rls: lock the new table against Supabase's REST API (RLS on, no policies).
ALTER TABLE "webhook_requests" ENABLE ROW LEVEL SECURITY;
