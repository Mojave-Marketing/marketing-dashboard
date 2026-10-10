import { Inter } from "next/font/google";
import AppShell from "../components/AppShell";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata = {
  title: "Mojave | Marketing Command Center",
  description: "Centralized marketing operations dashboard for Mojave",
};

const DEFAULT_FORMS = [
  { id: "arctidry-training", name: "Arctidry Training" },
  { id: "rep-company-feedback", name: "Rep Company Feedback" },
  { id: "arctidry-feedback", name: "Arctidry Feedback" },
];

// Mailchimp Surveys are a built-in "survey" source (standalone Surveys product,
// not inline email polls). Appended regardless of WEBHOOK_FORMS so it always
// appears next to Zapier survey entries.
const MAILCHIMP_FORM = { id: "email-satisfaction", name: "Mailchimp NPS Survey" };

function getForms() {
  let zapForms = DEFAULT_FORMS;
  try {
    if (process.env.WEBHOOK_FORMS) zapForms = JSON.parse(process.env.WEBHOOK_FORMS);
  } catch {}
  return [...zapForms, MAILCHIMP_FORM];
}

export default function RootLayout({ children }) {
  const forms = getForms();
  return (
    <html lang="en" className={inter.className}>
      <body>
        <AppShell forms={forms}>{children}</AppShell>
      </body>
    </html>
  );
}
