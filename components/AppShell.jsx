"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function AppShell({ children, forms }) {
  const pathname = usePathname();

  if (pathname.startsWith("/login")) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <Sidebar forms={forms} />
      <main className="app-main">{children}</main>
    </div>
  );
}
