"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

function buildNav(forms) {
  return [
    {
      id: "home",
      title: "Home",
      items: [{ label: "Calendar", href: "/" }],
    },
    {
      id: "emails",
      title: "Marketing Emails",
      items: [
        { label: "Campaign", href: "/emails" },
        { label: "Trends & Baseline", href: "/emails/trends" },
      ],
    },
    {
      id: "website",
      title: "Website Analytics",
      comingSoon: true,
      items: [{ label: "Overview", href: "/analytics/website" }],
    },
    {
      id: "linkedin",
      title: "LinkedIn Analytics",
      comingSoon: true,
      items: [{ label: "Overview", href: "/analytics/linkedin" }],
    },
    {
      id: "surveys",
      title: "Survey Responses",
      items: forms.map((f) => ({ label: f.name, href: `/surveys/${f.id}` })),
    },
    {
      id: "runbook",
      title: "Runbook",
      items: [{ label: "Runbook", href: "/runbook" }],
    },
  ];
}

function sectionIsActive(sectionId, pathname) {
  if (sectionId === "home") return pathname === "/";
  if (sectionId === "emails") return pathname.startsWith("/emails");
  if (sectionId === "website") return pathname.startsWith("/analytics/website");
  if (sectionId === "linkedin") return pathname.startsWith("/analytics/linkedin");
  if (sectionId === "surveys") return pathname.startsWith("/surveys");
  if (sectionId === "runbook") return pathname.startsWith("/runbook");
  return false;
}

export default function Sidebar({ forms = [] }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const NAV = buildNav(forms);

  return (
    <>
      <aside className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`}>
        <div className="sidebar-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="Mojave" className="sidebar-logo" />
          <span className="sidebar-brand-name">Marketing<br />Command Center</span>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((section) => {
            const active = sectionIsActive(section.id, pathname);
            return (
              <div key={section.id} className="sidebar-section">
                <div className={`sidebar-section-title${active ? " sidebar-section-title--active" : ""}`}>
                  <span>{section.title}</span>
                  {section.comingSoon && <span className="sidebar-badge">Soon</span>}
                </div>
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-item${pathname === item.href ? " sidebar-item--active" : ""}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            className="logout-btn"
            onClick={async () => {
              await fetch("/api/logout", { method: "POST" });
              window.location.href = "/login";
            }}
          >
            Log out
          </button>
        </div>
      </aside>

      <button
        className="sidebar-toggle"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? "›" : "‹"}
      </button>
    </>
  );
}
