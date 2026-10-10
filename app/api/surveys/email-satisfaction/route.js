import { NextResponse } from "next/server";
import {
  listMailchimpSurveys,
  getMailchimpSurveyWithQuestions,
  getMailchimpSurveyResponses,
} from "../../../../lib/mailchimp";

// Returns the latest published Mailchimp Survey + its responses, normalized
// into one of two shapes the view component already understands:
//   { shape: "per-recipient", survey, question, responses: [{Email, Rating, _receivedAt}], total }
//   { shape: "aggregate",     survey, question, distribution, totalVotes, avgRating }
// Query param ?surveyId=X selects a specific survey; without it we pick the
// most recent published survey.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const surveyIdParam = searchParams.get("surveyId");

  try {
    let surveyId = surveyIdParam;
    if (!surveyId) {
      const surveys = await listMailchimpSurveys();
      const published = surveys.filter((s) => s.status === "published");
      if (published.length === 0) {
        return NextResponse.json({
          shape: "none",
          message: "No published Mailchimp surveys found.",
        });
      }
      // Newest-first by published_at. Mailchimp returns surveys without a
      // guaranteed order so we sort explicitly.
      published.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
      surveyId = published[0].id;
    }

    const survey = await getMailchimpSurveyWithQuestions(surveyId);
    // We handle the first question only. If future surveys have more, we can
    // extend the shape to return an array of question results.
    const question = survey.questions[0];
    if (!question) {
      return NextResponse.json({
        shape: "none",
        survey,
        message: "Survey has no questions.",
      });
    }

    const totalResponses = Number(survey.total_responses || 0);

    // No responses yet — build the aggregate shape from the per-option counts
    // (which will all be zero). This still shows the question + scale in the UI.
    if (totalResponses === 0) {
      return NextResponse.json({
        shape: "aggregate",
        survey: { id: survey.id, title: survey.title, publishedAt: survey.published_at },
        question: { id: question.id, query: question.query, type: question.type },
        distribution: aggregateFromOptions(question),
        totalVotes: 0,
        avgRating: 0,
      });
    }

    const responses = await getMailchimpSurveyResponses(surveyId);
    const normalized = normalizeResponses(responses, question);

    if (normalized.length > 0) {
      return NextResponse.json({
        shape: "per-recipient",
        survey: { id: survey.id, title: survey.title, publishedAt: survey.published_at },
        question: { id: question.id, query: question.query, type: question.type },
        responses: normalized,
        total: normalized.length,
      });
    }

    // Mailchimp reports responses exist (total_responses > 0) but we couldn't
    // extract per-recipient rows — likely anonymous survey. Fall back to the
    // aggregate counts attached to the question.
    const distribution = aggregateFromOptions(question);
    const totalVotes = distribution.reduce((s, d) => s + d.votes, 0);
    const avgRating = totalVotes > 0
      ? distribution.reduce((s, d) => s + d.rating * d.votes, 0) / totalVotes
      : 0;
    return NextResponse.json({
      shape: "aggregate",
      survey: { id: survey.id, title: survey.title, publishedAt: survey.published_at },
      question: { id: question.id, query: question.query, type: question.type },
      distribution,
      totalVotes,
      avgRating,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Failed to load survey results" },
      { status: 500 }
    );
  }
}

function aggregateFromOptions(question) {
  const opts = question.options || [];
  // Range-type questions use numeric labels. For a 1-10 scale we drop the 0
  // option so the distribution matches the question wording ("1-10").
  return opts
    .map((o) => ({ rating: Number(o.label ?? o.id), votes: Number(o.count || 0) }))
    .filter((d) => Number.isFinite(d.rating) && d.rating >= 1 && d.rating <= 10)
    .sort((a, b) => a.rating - b.rating);
}

function normalizeResponses(responses, question) {
  const rows = [];
  for (const r of responses) {
    const answer = (r.answers || []).find((a) => String(a.question_id) === String(question.id));
    if (!answer) continue;
    const rating = Number(answer.value);
    if (!Number.isFinite(rating)) continue;
    rows.push({
      Email: r.contact?.email_address || r.contact?.full_name || "Anonymous",
      Rating: rating,
      _receivedAt: r.submitted_at || r.updated_at || new Date().toISOString(),
    });
  }
  rows.sort((a, b) => new Date(b._receivedAt) - new Date(a._receivedAt));
  return rows;
}
