import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClientBase } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // The `createServerClient` method can be called from a Server
            // Component, where `cookies.set` is not allowed. This is a known
            // limitation; the proxy (middleware) refreshes tokens instead.
          }
        },
      },
    },
  );
}

// Admin client for privileged operations (creating users, admin-user listing).
// Uses the service_role key and is NOT tied to a browser session. MUST only be
// used in route handlers / server code, never exposed to the client.
export function createAdminClient() {
  return createAdminClientBase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}