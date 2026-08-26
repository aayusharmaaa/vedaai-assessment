"use client";

import {
  ArrowLeft,
  Bell,
  ChevronDown,
  ClipboardList,
  FileText,
  HelpCircle,
  LayoutGrid,
  Menu,
  MonitorPlay,
  PanelLeft,
  PieChart,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";

import { ArtworkImage } from "@/components/ArtworkImage";
import { cn } from "@/lib/cn";

/**
 * The shell is modelled on the Figma, but this assignment scopes to the Exams
 * flow. The rest of the chrome is presentational - labelled as such on hover and
 * given a default cursor, so it reads as a deliberate boundary rather than a
 * dead button.
 */
const OUT_OF_SCOPE = "Presentational only — this build covers the Exams flow";

/**
 * Top-bar icon control, taken from the Figma frame spec:
 * 36x36, white background, fully rounded, contents centred.
 */
const TOP_BAR_CONTROL =
  "grid h-9 w-9 shrink-0 cursor-default place-items-center rounded-full bg-white text-ink transition hover:bg-surface-muted";

/** Avatar artwork, once dropped into public/. */
const USER_AVATAR = "/user.png";

/** School crest artwork, once dropped into public/. */
const SCHOOL_CREST = "/school-crest.png";

/** The signed-in teacher. Static: the brief specifies no authentication. */
const TEACHER = { name: "Pratyush Upadhyay", initials: "PU" };

const NAV = [
  { label: "Home", icon: LayoutGrid },
  { label: "My Classroom", icon: MonitorPlay },
  { label: "Assignments", icon: FileText },
  { label: "Exams", icon: ClipboardList, active: true },
  { label: "My Library", icon: PieChart },
];

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path d="M4 5h5.2l2.8 8.4L14.8 5H20l-6 14h-4L4 5z" fill="#fff" />
        </svg>
      </div>
      {!compact && <span className="text-[22px] font-extrabold tracking-tight">VedaAI</span>}
    </div>
  );
}

function SchoolCard({ compact = false }: { compact?: boolean }) {
  const crest = (
    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-white">
      <ArtworkImage
        src={SCHOOL_CREST}
        className="h-full w-full object-contain p-[3px]"
        fallback={
          <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
            <path
              d="M16 3l11 4v9c0 6.6-4.6 11.6-11 13C9.6 27.6 5 22.6 5 16V7l11-4z"
              fill="none"
              stroke="#2f6b3a"
              strokeWidth="1.8"
            />
            <path d="M16 9v11M11 13h10M12 24h8" stroke="#2f6b3a" strokeWidth="1.6" fill="none" />
          </svg>
        }
      />
    </div>
  );

  if (compact) return crest;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-muted p-3">
      {crest}
      <div className="min-w-0">
        <p className="truncate text-[15px] font-bold leading-tight">Delhi Public School</p>
        <p className="truncate text-[13px] text-ink-faint">Bokaro Steel City</p>
      </div>
    </div>
  );
}

function SidebarBody({
  collapsed,
  onToggle,
  onNavigate,
  showToggle = true,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  showToggle?: boolean;
}) {
  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-slim p-4">
      {/*
        The toggle lives here in both states. Keeping it only at the foot of
        the rail meant that on a short viewport the collapsed sidebar had no
        reachable way back open.
      */}
      <div
        className={cn(
          "flex shrink-0 items-center",
          collapsed ? "flex-col gap-3" : "justify-between",
        )}
      >
        <Wordmark compact={collapsed} />
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-faint transition hover:bg-surface-muted hover:text-ink"
          >
            <PanelLeft className={cn("h-5 w-5 transition-transform", collapsed && "rotate-180")} />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onNavigate}
        title={`AI Teacher's Toolkit — ${OUT_OF_SCOPE}`}
        className={cn(
          "group mt-8 flex cursor-default items-center justify-center gap-2.5 rounded-full bg-ink text-white shadow-sm ring-[3px] ring-accent transition hover:bg-black",
          collapsed ? "h-12 w-12 self-center p-0" : "h-[54px] w-full px-4",
        )}
      >
        <Sparkles className="h-[19px] w-[19px] shrink-0 text-white" />
        {!collapsed && <span className="text-[16px] font-semibold">AI Teacher&apos;s Toolkit</span>}
      </button>

      <nav className={cn("mt-10 flex flex-col gap-2", collapsed && "items-center")}>
        {NAV.map(({ label, icon: Icon, active }) => (
          <button
            key={label}
            type="button"
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={active ? (collapsed ? label : undefined) : `${label} — ${OUT_OF_SCOPE}`}
            className={cn(
              "flex items-center rounded-xl text-[16px] transition",
              collapsed ? "h-12 w-12 justify-center" : "h-[52px] w-full gap-3.5 px-3.5",
              active
                ? "bg-surface-muted font-semibold text-ink"
                : "cursor-default font-medium text-ink-soft hover:bg-surface-muted",
            )}
          >
            <Icon className="h-[21px] w-[21px] shrink-0" />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
      </nav>

      <div className="mt-auto space-y-4 pt-6">
        <button
          type="button"
          onClick={onNavigate}
          title={`Settings — ${OUT_OF_SCOPE}`}
          className={cn(
            "flex cursor-default items-center rounded-xl font-medium text-ink-soft transition hover:bg-surface-muted",
            collapsed ? "h-11 w-11 justify-center" : "h-12 w-full gap-3 px-3 text-[15px]",
          )}
        >
          <Settings className="h-[19px] w-[19px] shrink-0" />
          {!collapsed && <span>Settings</span>}
        </button>
        <SchoolCard compact={collapsed} />
      </div>
    </div>
  );
}

export interface AppShellProps {
  /** Breadcrumb label shown in the top bar. */
  crumb: string;
  /** Shown when the user can step back to the upload screen. */
  onBack?: () => void;
  children: React.ReactNode;
}

export function AppShell({ crumb, onBack, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="flex h-full min-h-dvh lg:h-dvh lg:overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 transition-[width] duration-300 lg:block",
          collapsed ? "w-[92px]" : "w-[300px]",
        )}
      >
        <div className="h-full rounded-r-[28px] bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <SidebarBody collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 w-[280px] bg-surface shadow-xl">
            <button
              type="button"
              onClick={() => setDrawer(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 z-10 grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:bg-surface-muted"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarBody
              collapsed={false}
              onToggle={() => undefined}
              onNavigate={() => setDrawer(false)}
              showToggle={false}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:h-dvh lg:overflow-hidden">
        <header className="shrink-0 px-3 pt-3 lg:px-5 lg:pt-4">
          <div className="flex h-[62px] items-center gap-3 rounded-[20px] bg-surface px-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:px-5">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-label="Open menu"
              className="grid h-9 w-9 place-items-center rounded-lg text-ink transition hover:bg-surface-muted lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back to upload"
                className="hidden h-9 w-9 place-items-center rounded-lg text-ink transition hover:bg-surface-muted lg:grid"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : (
              <div className="hidden h-9 w-9 lg:block" />
            )}

            <div className="flex min-w-0 items-center gap-2 text-ink-soft">
              <ClipboardList className="hidden h-[18px] w-[18px] shrink-0 lg:block" />
              <span className="truncate text-[16px] font-medium">{crumb}</span>
            </div>

            <div className="ml-auto flex items-center gap-1.5 lg:gap-3">
              <button
                type="button"
                aria-label="Help"
                title={`Help — ${OUT_OF_SCOPE}`}
                className={cn(TOP_BAR_CONTROL, "hidden lg:grid")}
              >
                <HelpCircle className="h-[21px] w-[21px]" strokeWidth={1.8} />
              </button>

              <button
                type="button"
                aria-label="Notifications"
                title={`Notifications — ${OUT_OF_SCOPE}`}
                className={cn(TOP_BAR_CONTROL, "relative")}
              >
                <Bell className="h-[21px] w-[21px]" strokeWidth={1.8} />
                <span className="absolute right-[7px] top-[7px] h-[7px] w-[7px] rounded-full bg-accent ring-2 ring-white" />
              </button>

              <button
                type="button"
                aria-label="AI assistant"
                title={`AI assistant — ${OUT_OF_SCOPE}`}
                className={cn(TOP_BAR_CONTROL, "hidden lg:grid")}
              >
                {/* Solid four-point star, not lucide's two-star Sparkles. */}
                <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="currentColor" aria-hidden="true">
                  <path d="M12 1.6l2.2 6.4c.3.9 1 1.6 1.9 1.9l6.3 2.1-6.3 2.1c-.9.3-1.6 1-1.9 1.9L12 22.4l-2.2-6.4a3.2 3.2 0 00-1.9-1.9L1.6 12l6.3-2.1c.9-.3 1.6-1 1.9-1.9z" />
                </svg>
              </button>

              <button
                type="button"
                title={`${TEACHER.name} — ${OUT_OF_SCOPE}`}
                className="flex cursor-default items-center gap-2 rounded-full py-1 pl-1 pr-1 transition hover:bg-surface-muted lg:pr-2"
              >
                <span className="grid h-9 w-9 shrink-0 overflow-hidden rounded-full bg-surface-muted">
                  <ArtworkImage
                    src={USER_AVATAR}
                    className="h-full w-full object-cover"
                    fallback={
                      <span className="grid h-full w-full place-items-center bg-gradient-to-br from-amber-200 to-orange-300 text-[13px] font-bold text-orange-900">
                        {TEACHER.initials}
                      </span>
                    }
                  />
                </span>
                <span className="hidden text-[15px] font-semibold lg:inline">{TEACHER.name}</span>
                <ChevronDown className="hidden h-4 w-4 text-ink-faint lg:block" />
              </button>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 lg:overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
