import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import { getSessionToken } from "@/lib/session";

async function forward(
  request: NextRequest,
  ctx: RouteContext<"/api/backend/[...path]">,
): Promise<Response> {
  const { path } = await ctx.params;
  const token = await getSessionToken();

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const targetUrl = new URL(`/api/${path.join("/")}`, BACKEND_URL);
  targetUrl.search = request.nextUrl.search;

  const init: RequestInit = {
    method: request.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const bodyText = await request.text();
    if (bodyText) init.body = bodyText;
  }

  const backendResponse = await fetch(targetUrl, init);

  // 204/205/304 are "null body" statuses per the Fetch spec -- the Response
  // constructor throws if given a body at all, even an empty string, so
  // these can't fall through to the text/JSON branches below (a DELETE
  // endpoint returning 204 with no body is exactly this case).
  if ([204, 205, 304].includes(backendResponse.status)) {
    return new Response(null, { status: backendResponse.status });
  }

  const contentType = backendResponse.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data = await backendResponse.json();
    return NextResponse.json(data, { status: backendResponse.status });
  }

  const text = await backendResponse.text();
  return new Response(text, { status: backendResponse.status });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
export const PUT = forward;
