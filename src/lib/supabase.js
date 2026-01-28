import { createClient } from "@supabase/supabase-js";

// Shared Supabase client for background, popup, and content script.
// Ensures all parts of the extension use the same instance and session.
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
);

export default supabase;
