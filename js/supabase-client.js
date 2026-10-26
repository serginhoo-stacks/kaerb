/* Cliente público; a autorização continua protegida pelo Supabase Auth e RLS. */
"use strict";

(() => {
  const config = window.KAERB_SUPABASE_CONFIG;
  if (!config || !window.supabase) {
    window.kaerbSupabase = null;
    return;
  }

  window.kaerbSupabase = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
})();
