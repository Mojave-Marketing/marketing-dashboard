import { get, list } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { formId } = params;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ responses: [], total: 0, unconfigured: true });
  }

  try {
    const { blobs } = await list({ prefix: `surveys/${formId}/` });
    if (blobs.length === 0) {
      return NextResponse.json({ responses: [], total: 0 });
    }

    const responses = await Promise.all(
      blobs.map(async (blob) => {
        const result = await get(blob.pathname, { access: "private" });
        if (!result || result.statusCode !== 200) return null;
        return new Response(result.stream).json();
      })
    );

    const valid = responses
      .filter(Boolean)
      .filter(isNotGoogleFormsSample)
      .sort((a, b) => new Date(b._receivedAt) - new Date(a._receivedAt));

    return NextResponse.json({ responses: valid, total: valid.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Failed to load responses" },
      { status: 500 }
    );
  }
}

// Google Forms' quiz template fills every answer with "sample text question
// answer" when you test-view a form. Drop any response where any field holds
// that exact placeholder string.
const SAMPLE_VALUE = "sample text question answer";
function isNotGoogleFormsSample(response) {
  if (!response || typeof response !== "object") return true;
  return !Object.values(response).some(
    (v) => typeof v === "string" && v.trim().toLowerCase() === SAMPLE_VALUE
  );
}
