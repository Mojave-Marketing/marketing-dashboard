import { get, list } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { formId } = params;
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("raw") === "1";

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

    // ?raw=1 — diagnostic: return everything including filtered sample
    // responses, so UUID field keys and their values are visible for
    // mapping to real question text.
    const base = responses
      .filter(Boolean)
      .sort((a, b) => new Date(b._receivedAt) - new Date(a._receivedAt));
    const valid = raw
      ? base
      : base
          .filter(isNotGoogleFormsSample)
          .filter(hasRealQuestionKeys)
          .filter(isSubmittedTodayOrLater);

    return NextResponse.json({ responses: valid, total: valid.length, ...(raw ? { raw: true } : {}) });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Failed to load responses" },
      { status: 500 }
    );
  }
}

// Filter out responses that aren't usable in the dashboard:
//   1. Google Forms test submissions with the "sample text question answer"
//      placeholder (what Google writes when you preview/test a form).
//   2. Pre-Zap-fix responses whose field keys are raw Google Forms question
//      IDs (8-char hex strings like "04c09205") instead of human-readable
//      question text — those render as unreadable rows.
const SAMPLE_VALUE = "sample text question answer";
const UUID_KEY_RE = /^[0-9a-f]{8}$/i;

// Recursively check whether the sample placeholder appears anywhere in a
// response — including as a substring, since some Zaps serialize nested
// Q&A pairs into a stringified-dict blob (e.g. the Rep Company Feedback
// webhook sends `questions: "{'issueDetails': 'sample text question answer', ...}"`).
function hasSampleTextAnywhere(value) {
  if (typeof value === "string") {
    return value.toLowerCase().includes(SAMPLE_VALUE);
  }
  if (Array.isArray(value)) return value.some(hasSampleTextAnywhere);
  if (value && typeof value === "object") {
    return Object.values(value).some(hasSampleTextAnywhere);
  }
  return false;
}

function isNotGoogleFormsSample(response) {
  if (!response || typeof response !== "object") return true;
  return !hasSampleTextAnywhere(response);
}

function hasRealQuestionKeys(response) {
  if (!response || typeof response !== "object") return true;
  return !Object.keys(response).some((k) => UUID_KEY_RE.test(k));
}

// Hide anything stored before today (UTC). Pre-production test submissions
// predate the Zap fix; this is a belt-and-suspenders filter to catch anything
// the sample-text / UUID-key filters miss.
function isSubmittedTodayOrLater(response) {
  const t = response?._receivedAt;
  if (!t) return false;
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  return new Date(t) >= startOfToday;
}
