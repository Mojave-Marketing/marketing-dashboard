import SurveyTable from "../../../components/SurveyTable";

const DEFAULT_FORMS = [
  { id: "arctidry-training", name: "Arctidry Training" },
  { id: "rep-company-feedback", name: "Rep Company Feedback" },
  { id: "arctidry-feedback", name: "Arctidry Feedback" },
];

function getFormName(formId) {
  let forms = DEFAULT_FORMS;
  try {
    if (process.env.WEBHOOK_FORMS) forms = JSON.parse(process.env.WEBHOOK_FORMS);
  } catch {}
  return (
    forms.find((f) => f.id === formId)?.name ||
    formId.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
  );
}

export default function SurveyPage({ params }) {
  const { formId } = params;
  const formName = getFormName(formId);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{formName}</h1>
        <p className="page-subtitle">Survey responses</p>
      </div>
      <SurveyTable formId={formId} />
    </div>
  );
}
