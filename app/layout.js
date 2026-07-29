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

function getForms() {
  try {
    if (process.env.WEBHOOK_FORMS) return JSON.parse(process.env.WEBHOOK_FORMS);
  } catch {}
  return DEFAULT_FORMS;
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
