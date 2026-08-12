import { NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const name = String(form.get("name") ?? "").trim();

  if (!verifyPassword(password)) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }

  await createSession(name || "Team");
  return NextResponse.redirect(new URL("/", request.url), 303);
}
