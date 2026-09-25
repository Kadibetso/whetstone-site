/*
  Fill these in with YOUR Supabase project's values.
  Find them in your Supabase dashboard under: Project Settings → API
    - SUPABASE_URL      = "Project URL"
    - SUPABASE_ANON_KEY = "anon public" key (safe to expose in client-side code)

  Do NOT put your "service_role" key here — that one must never be public.
*/
const SUPABASE_URL = "https://ivnutchxjxvsrswnxedy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2bnV0Y2h4anh2c3Jzd254ZWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMzEzMDcsImV4cCI6MjEwNTkwNzMwN30.wmzdbb8ijdu9GxvunHgvUT8enKAPjx8Xwwr8IMTafoI";

const supabaseClient = (SUPABASE_URL.indexOf("YOUR_") === 0)
  ? null
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
