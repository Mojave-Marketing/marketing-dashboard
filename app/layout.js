import "./globals.css";

export const metadata = {
  title: "Rep Training Email Dashboard",
  description: "Mailchimp campaign performance for rep training sends",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
