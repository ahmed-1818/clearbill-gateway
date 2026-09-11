import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

export function createServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables missing! Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }

  // The service_role key allows the backend to bypass RLS to perform system-level updates
  // like settling invoices or fetching data for reminders.
  return createClient(supabaseUrl, supabaseKey);
}
