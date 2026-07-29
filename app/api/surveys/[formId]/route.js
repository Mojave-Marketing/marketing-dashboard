import { list } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { formId } = params;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ responses: [], total: 0, unconfigured: true });
  }

  try {
    const { blobs } = await list({ prefix: `surveys/${formId}.json` });
    if (blobs.length === 0) {
      return NextResponse.json({ responses: [], total: 0 });
    }
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    const responses = await res.json();
    return NextResponse.json({ responses, total: responses.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Failed to load responses" },
      { status: 500 }
    );
  }
}
