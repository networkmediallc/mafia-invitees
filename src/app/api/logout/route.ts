import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { absoluteUrl } from "@/lib/request-url";

export async function POST(request: Request) {
  await destroySession();
  return NextResponse.redirect(absoluteUrl(request, "/login"), 303);
}
