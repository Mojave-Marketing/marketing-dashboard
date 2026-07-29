import { list, put } from "@vercel/blob";
import { NextResponse } from "next/server";

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

  const blobKey = `surveys/${formId}.json`;

  // Read existing responses
  let responses = [];
  try {
    const { blobs } = await list({ prefix: blobKey });
    if (blobs.length > 0) {
      const res = await fetch(blobs[0].url, { cache: "no-store" });
      responses = await res.json();
    }
  } catch {}

  // Prepend — newest first
  responses.unshift({ ...payload, _receivedAt: new Date().toISOString() });

  await put(blobKey, JSON.stringify(responses), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });

  return NextResponse.json({ ok: true, count: responses.length });
}
