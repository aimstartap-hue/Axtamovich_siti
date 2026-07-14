// =============================================================================
// Markaziy xato logi — YAGONA sink (Priority 8).
// Boshqa hech qayerda console to'g'ridan-to'g'ri ishlatilmaydi. Bu yagona joy
// Vercel Function Logs tomonidan ushlanadi; keyinchalik Sentry/tashqi log ga
// shu yerda ulanadi (chaqiruvchi kod o'zgarmaydi).
// =============================================================================

type LogContext = Record<string, unknown>;

export function logError(scope: string, error: unknown, context: LogContext = {}): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(
    JSON.stringify({ level: "error", scope, message, stack, ...context, at: new Date().toISOString() }),
  );
}
