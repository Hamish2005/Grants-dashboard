"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Files,
  CheckSquare,
  CalendarDays,
  Layers,
  Upload,
  Workflow,
  Settings,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
const links = [
  ["/", "Overview", LayoutDashboard],
  ["/grants", "All grants", Files],
  ["/tasks", "My tasks", CheckSquare],
  ["/deadlines", "Upcoming deadlines", CalendarDays],
  ["/cycles", "Funding cycles", Layers],
  ["/import", "Import grants", Upload],
  ["/templates", "Workflow templates", Workflow],
  ["/settings", "Settings", Settings],
] as const;
export function Shell({
  children,
  name,
  role,
}: {
  children: React.ReactNode;
  name: string;
  role: string;
}) {
  const pathname = usePathname();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link
          href="/"
          className="brand"
          aria-label="RTFH — Grants workspace home"
        >
          <Image
            className="brand-logo"
            src="/brand/rtfh-logo.svg"
            alt="Regional Task Force on Homelessness, San Diego"
            width={140}
            height={72}
            unoptimized
          />
          <Image
            className="brand-icon"
            src="/brand/rtfh-mark.png"
            alt=""
            width={44}
            height={44}
            unoptimized
          />
        </Link>
        <div className="workspace-label">GRANTS WORKSPACE</div>
        <nav>
          {links.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={`nav-item ${pathname === href || (href === "/grants" && pathname.startsWith("/grants/")) ? "selected" : ""}`}
            >
              <Icon size={18} />
              <span>{label}</span>
              {href === "/import" && <span className="nav-new">NEW</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <ShieldCheck size={17} />
            <div>
              Internal workspace<small>San Diego Continuum of Care</small>
            </div>
          </div>
          <div className="profile">
            <span className="avatar">
              {name
                .split(" ")
                .map((x) => x[0])
                .join("")}
            </span>
            <div>
              <strong>{name}</strong>
              <small>{role} · Grants & Contracts</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Grants & Contracts <span className="slash">/</span>{" "}
            <strong>
              {links.find(([href]) => href === pathname)?.[1] ||
                "Grant details"}
            </strong>
          </span>
          <a
            href="https://www.rtfhsd.org/funding/grants-recipients/"
            target="_blank"
            rel="noreferrer"
          >
            RTFH resources <ArrowUpRight size={14} />
          </a>
        </header>
        <main>{children}</main>
        <footer>
          Regional Task Force on Homelessness{" "}
          <span>
            Deadlines shown in Pacific Time · Date-only values preserved
          </span>
        </footer>
      </div>
    </div>
  );
}
