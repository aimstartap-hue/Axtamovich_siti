import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Server komponentlar / server action'lar uchun Supabase client (foydalanuvchi sessiyasi bilan). */
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
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component ichida set chaqirilsa e'tiborsiz qoldiriladi (middleware yangilaydi).
          }
        },
      },
    },
  );
}
