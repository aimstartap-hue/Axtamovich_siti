import { createClient as createSbClient } from "@supabase/supabase-js";

/**
 * Service-role client — RLS ni chetlab o'tadi.
 * FAQAT serverda, ishonchli amallar uchun (foydalanuvchi yaratish, migratsiya).
 * Hech qachon brauzerga chiqmasin.
 */
export function createAdminClient() {
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
