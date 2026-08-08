import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import { setSession } from "@/lib/session";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();

  const backendResponse = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await backendResponse.json();

  if (!backendResponse.ok) {
    return NextResponse.json(data, { status: backendResponse.status });
  }

  await setSession(data.token, data.user);

  return NextResponse.json({ user: data.user }, { status: 200 });
}
