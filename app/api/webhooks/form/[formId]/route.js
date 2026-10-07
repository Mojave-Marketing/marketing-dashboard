import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request, { params }) {
  const { formId } = params;
  const { searchParams } = new URL(request.url);

  const secret = process.env.WEBHOOK_SECRET;
  if (secret && searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const timestamp = Date.now();
  const blobKey = `surveys/${formId}/${timestamp}.json`;

  await put(blobKey, JSON.stringify({ ...payload, _receivedAt: new Date().toISOString() }), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
  });

  return NextResponse.json({ ok: true });
}
