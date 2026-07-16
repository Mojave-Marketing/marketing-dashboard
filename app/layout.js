import { Inter } from "next/font/google";
import "./globals.css";

// Inter is the web-safe substitute for Telegraf (body) and approximates
// Segoe UI Bold for headers when paired with font-weight: 700+.
const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata = {
  title: "Mojave | Marketing Dashboard",
  description: "Mailchimp campaign performance dashboard for Mojave rep training sends",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
