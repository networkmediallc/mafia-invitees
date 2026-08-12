import { NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { absoluteUrl } from "@/lib/request-url";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const name = String(form.get("name") ?? "").trim();

  if (!verifyPassword(password)) {
    return NextResponse.redirect(absoluteUrl(request, "/login?error=1"), 303);
  }

  await createSession(name || "Team");
  return NextResponse.redirect(absoluteUrl(request, "/"), 303);
}
