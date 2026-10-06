/**
 * Starts an hourly invite-addition digest loop on the Node server.
 * Only runs when NOTIFY_EMAIL + RESEND_API_KEY are set (Railway Docker / `next start`).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  // Skip during `next build` (no real DB / secrets).
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  const to = process.env.NOTIFY_EMAIL?.trim();
  const key = process.env.RESEND_API_KEY?.trim();
  if (!to || !key) return;

  const HOUR_MS = 60 * 60 * 1000;
  const g = globalThis as unknown as {
    __inviteDigestTimer?: ReturnType<typeof setInterval>;
  };
  if (g.__inviteDigestTimer) return;

  const tick = async () => {
    try {
      const { sendInviteAdditionDigest } = await import("@/lib/invite-digest");
      const result = await sendInviteAdditionDigest();
      if (result.sent) {
        console.info(
          `[invite-digest] sent digest for ${result.count} addition(s) across ${result.events} event(s)`,
        );
      } else if (result.reason === "send_failed") {
        console.error(`[invite-digest] send failed: ${result.error}`);
      }
    } catch (err) {
      console.error("[invite-digest] tick failed", err);
    }
  };

  // First check ~2 minutes after boot, then every hour.
  setTimeout(() => {
    void tick();
    g.__inviteDigestTimer = setInterval(() => void tick(), HOUR_MS);
  }, 2 * 60 * 1000);
}
