import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import { getSessionToken } from "@/lib/session";

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/backend/properties/[id]/media">,
): Promise<Response> {
  const { id } = await ctx.params;
  const token = await getSessionToken();

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const incomingFormData = await request.formData();
  const file = incomingFormData.get("file");

  if (!file) {
    return NextResponse.json({ error: 'No file provided (expected multipart field "file")' }, { status: 400 });
  }

  const outgoingFormData = new FormData();
  outgoingFormData.set("file", file);

  const backendResponse = await fetch(`${BACKEND_URL}/api/properties/${id}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: outgoingFormData,
  });

  const data = await backendResponse.json();
  return NextResponse.json(data, { status: backendResponse.status });
}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<"/api/backend/properties/[id]/media">,
): Promise<Response> {
  const { id } = await ctx.params;
  const token = await getSessionToken();

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const targetUrl = new URL(`/api/properties/${id}/media`, BACKEND_URL);
  targetUrl.search = request.nextUrl.search;

  const backendResponse = await fetch(targetUrl, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await backendResponse.json();
  return NextResponse.json(data, { status: backendResponse.status });
}
