import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  inviteDigestEnabled,
  sendInviteAdditionDigest,
} from "@/lib/invite-digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        hint: "Set CRON_SECRET and send Authorization: Bearer <secret>",
      },
      { status: 401 },
    );
  }
  if (!inviteDigestEnabled()) {
    return NextResponse.json({
      sent: false,
      reason: "misconfigured",
      hint: "Set NOTIFY_EMAIL and RESEND_API_KEY",
    });
  }

  const result = await sendInviteAdditionDigest();
  const status = result.reason === "send_failed" ? 502 : 200;
  return NextResponse.json(result, { status });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
