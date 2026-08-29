"use client";

import {
  ArrowLeft,
  Bell,
  ChevronDown,
  Clipboard,
  HelpCircle,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ArtworkImage } from "@/components/ArtworkImage";
import { NavIcon, type NavIconId } from "@/components/NavIcons";
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
  "shadow-control grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-ink transition hover:bg-surface-muted";

/** Inert chrome keeps the arrow cursor so it does not invite a click. */
const TOP_BAR_INERT = "cursor-default";

/** Avatar artwork, once dropped into public/. */
const USER_AVATAR = "/user.png";

/** School crest artwork, once dropped into public/. */
const SCHOOL_CREST = "/school-crest.png";

/** Collapsed-sidebar school tile from Figma export. */
const SCHOOL_CREST_COMPACT = "/school-crest-compact.png";

/** Collapsed-sidebar expand chevron from Figma export. */
const SIDEBAR_EXPAND = "/sidebar-expand.png";

/** Full wordmark from Figma export. */
const VEDAAI_LOGO = "/vedaai-logo.png";

/** AI Teacher's Toolkit pill badge from Figma export. */
const AI_TOOLKIT_LOGO = "/ai-toolkit-button.png";

/** The signed-in teacher. Static: the brief specifies no authentication. */
const TEACHER = { name: "Madhur Rastogi", initials: "MR" };

/** Collapsed rail — 80px wide, 40px nav targets, 100px toolkit (h-25). */
const COLLAPSED_RAIL = "w-[80px]";
const COLLAPSED_BTN = "h-10 w-10";
const COLLAPSED_TOOLKIT = "h-35 w-35";
const COLLAPSED_ICON = "h-5 w-5";

function ShellIcon({ src, className }: { src: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      className={cn(COLLAPSED_ICON, "shrink-0 object-contain", className)}
    />
  );
}

const NAV: { label: string; icon: NavIconId; active?: boolean }[] = [
  { label: "Home", icon: "home" },
  { label: "My Classroom", icon: "classroom" },
  { label: "Assignments", icon: "assignments" },
  { label: "Exams", icon: "exams", active: true },
  { label: "My Library", icon: "library" },
];

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <ArtworkImage
      src={compact ? "/vedaai-icon.png" : VEDAAI_LOGO}
      className={cn(
        "shrink-0 object-contain object-left",
        compact ? "h-9 w-9" : "h-8 w-[132px]",
      )}
      fallback={
        <span className="text-[20px] font-extrabold tracking-tight text-[#2b2b2b]">
          {compact ? "V" : "VedaAI"}
        </span>
      }
    />
  );
}

function SchoolCard({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <ArtworkImage
        src={SCHOOL_CREST_COMPACT}
        className="h-10 w-10 shrink-0 object-contain"
        fallback={
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white p-1">
            <ArtworkImage src={SCHOOL_CREST} className="h-full w-full object-contain" fallback={null} />
          </div>
        }
      />
    );
  }

  const crest = (
    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-white p-1">
      <ArtworkImage
        src={SCHOOL_CREST}
        className="h-full w-full object-contain"
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

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-muted p-3">
      {crest}
      <div className="min-w-0">
        <p className="truncate text-[14px] font-bold leading-tight">Delhi Public School</p>
        <p className="truncate text-[12px] text-ink-faint">Bokaro Steel City</p>
      </div>
    </div>
  );
}

function SidebarBody({
  collapsed,
  onToggle,
  onNavigate,
  showToggle = true,
  hideSettings = false,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  showToggle?: boolean;
  hideSettings?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-y-auto scrollbar-slim",
        collapsed ? "items-center p-3" : "p-3.5",
      )}
    >
      {/*
        The toggle lives here in both states. Keeping it only at the foot of
        the rail meant that on a short viewport the collapsed sidebar had no
        reachable way back open.
      */}
      <div
        className={cn(
          "flex shrink-0 items-center",
          collapsed ? "flex-col items-center" : "justify-between",
        )}
      >
        <Wordmark compact={collapsed} />
        {showToggle && !collapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            aria-expanded={!collapsed}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-faint transition hover:bg-surface-muted hover:text-ink"
          >
            <ShellIcon src="/panel-toggle.png" className="h-5 w-5 opacity-70" />
          </button>
        )}
      </div>

      <div className={cn("flex w-full shrink-0 items-center justify-center", collapsed ? "mt-4" : "hidden")}>
        <button
          type="button"
          onClick={onNavigate}
          title={`AI Teacher's Toolkit — ${OUT_OF_SCOPE}`}
          className={cn(
            "group mx-auto grid shrink-0 cursor-default place-items-center transition",
            COLLAPSED_TOOLKIT,
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/toolkit-collapsed.png"
            alt=""
            aria-hidden
            draggable={false}
            className="h-full w-full object-contain"
          />
        </button>
      </div>

      {!collapsed && (
        <button
          type="button"
          onClick={onNavigate}
          title={`AI Teacher's Toolkit — ${OUT_OF_SCOPE}`}
          className="group mt-9 block w-full cursor-default overflow-visible py-1 leading-none transition"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={AI_TOOLKIT_LOGO}
            alt="AI Teacher's Toolkit"
            draggable={false}
            className="block w-full h-auto"
          />
        </button>
      )}

      <nav className={cn("flex flex-col", collapsed ? "mt-4 items-center gap-1" : "mt-8 gap-1.5")}>
        {NAV.map(({ label, icon, active }) => (
          <button
            key={label}
            type="button"
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={active ? (collapsed ? label : undefined) : `${label} — ${OUT_OF_SCOPE}`}
            className={cn(
              "font-bricolage flex items-center rounded-xl text-[16px] leading-[1.4] tracking-[-0.04em] transition",
              collapsed ? cn("justify-center rounded-lg", COLLAPSED_BTN) : "h-[44px] w-full gap-3 px-3",
              active
                ? "bg-[#f0f0f0] font-medium text-[#303030]"
                : "cursor-default font-normal text-[rgba(94,94,94,0.8)] hover:bg-[#f0f0f0]",
            )}
          >
            <NavIcon id={icon} active={active} />
            {!collapsed && <span className="flex-1 text-left">{label}</span>}
          </button>
        ))}
      </nav>

      <div className={cn("mt-auto pt-6", collapsed ? "flex w-full flex-col items-center gap-3" : "space-y-4")}>
        {!hideSettings && (
        <button
          type="button"
          onClick={onNavigate}
          title={`Settings — ${OUT_OF_SCOPE}`}
          className={cn(
            "font-bricolage flex cursor-default items-center rounded-xl text-[16px] leading-[1.4] tracking-[-0.04em] font-normal text-[rgba(94,94,94,0.8)] transition hover:bg-[#f0f0f0]",
            collapsed ? cn("justify-center rounded-lg", COLLAPSED_BTN) : "h-[44px] w-full gap-3 px-3",
          )}
        >
          <Settings className={cn(COLLAPSED_ICON, "shrink-0 text-[rgba(94,94,94,0.8)]")} strokeWidth={2} />
          {!collapsed && <span>Settings</span>}
        </button>
        )}
        <SchoolCard compact={collapsed} />
        {collapsed && showToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            aria-expanded={false}
            className={cn(
              "grid shrink-0 place-items-center rounded-lg transition hover:bg-surface-muted",
              COLLAPSED_BTN,
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SIDEBAR_EXPAND}
              alt=""
              aria-hidden
              draggable={false}
              className="h-3 w-3 shrink-0 object-contain opacity-80"
            />
          </button>
        )}
      </div>
    </div>
  );
}

export interface AppShellProps {
  /** Breadcrumb label shown in the top bar. */
  crumb: string;
  /** Shown when the user can step back to the upload screen. */
  onBack?: () => void;
  /** Default collapse state for desktop sidebar. */
  defaultCollapsed?: boolean;
  /** Review layout drops the top chrome bar on desktop. */
  hideHeader?: boolean;
  /** Mobile screens use a compact logo header instead of the breadcrumb bar. */
  mobileReviewHeader?: boolean;
  /** Hide the sidebar Settings item once both files are attached. */
  hideSettings?: boolean;
  children: React.ReactNode;
}

function MobileReviewHeader({
  onBack,
  onOpenMenu,
}: {
  onBack?: () => void;
  onOpenMenu: () => void;
}) {
  return (
    <header className="shrink-0 px-3 pt-2.5 lg:hidden">
      <div className="shadow-header flex h-[54px] items-center gap-2 rounded-[18px] bg-surface px-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to upload"
            className={cn(TOP_BAR_CONTROL, "hover:bg-surface-muted")}
          >
            <ArrowLeft className="h-[19px] w-[19px]" strokeWidth={2.2} />
          </button>
        ) : (
          <button
            type="button"
            title={`Back — ${OUT_OF_SCOPE}`}
            className={cn(TOP_BAR_CONTROL, TOP_BAR_INERT)}
          >
            <ArrowLeft className="h-[19px] w-[19px]" strokeWidth={2.2} />
          </button>
        )}

        <div className="flex min-w-0 items-center gap-2">
          <Wordmark compact />
          <span className="font-bricolage truncate text-[18px] font-bold tracking-[-0.04em] text-ink">
            VedaAI
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Notifications"
            title={`Notifications — ${OUT_OF_SCOPE}`}
            className={cn(TOP_BAR_CONTROL, TOP_BAR_INERT, "relative")}
          >
            <Bell className="h-[21px] w-[21px]" strokeWidth={1.8} />
            <span className="absolute right-[7px] top-[7px] h-[7px] w-[7px] rounded-full bg-accent ring-2 ring-white" />
          </button>

          <button
            type="button"
            title={`${TEACHER.name} — ${OUT_OF_SCOPE}`}
            className={cn(TOP_BAR_INERT, "grid h-9 w-9 shrink-0 overflow-hidden rounded-full bg-surface-muted ring-1 ring-black/5")}
          >
            <ArtworkImage
              src={USER_AVATAR}
              className="h-full w-full object-cover object-center"
              fallback={
                <span className="grid h-full w-full place-items-center bg-gradient-to-br from-amber-200 to-orange-300 text-[13px] font-bold text-orange-900">
                  {TEACHER.initials}
                </span>
              }
            />
          </button>

          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open menu"
            className="grid h-9 w-9 place-items-center rounded-lg text-ink transition hover:bg-surface-muted"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function AppShell({
  crumb,
  onBack,
  defaultCollapsed = false,
  hideHeader = false,
  mobileReviewHeader = false,
  hideSettings = false,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    setCollapsed(defaultCollapsed);
  }, [defaultCollapsed]);

  return (
    <div className="flex h-full min-h-dvh lg:h-dvh lg:overflow-hidden lg:pb-3 lg:pl-3 lg:pt-3">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 transition-[width] duration-300 lg:block",
          collapsed ? COLLAPSED_RAIL : "w-[260px]",
        )}
      >
        <div className="h-full rounded-[28px] border border-[#e8e8e8] bg-surface shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
          <SidebarBody
            collapsed={collapsed}
            onToggle={() => setCollapsed((c) => !c)}
            hideSettings={hideSettings}
          />
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
          <div className="absolute inset-y-3 left-3 w-[280px] rounded-[28px] border border-[#e8e8e8] bg-surface shadow-xl">
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
              hideSettings={hideSettings}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:h-dvh lg:overflow-hidden">
        {!hideHeader && (
        <header
          className={cn(
            "shrink-0 px-3 pt-2.5 lg:px-4 lg:pt-3",
            mobileReviewHeader && "hidden lg:block",
          )}
        >
          <div className="shadow-header flex h-[54px] items-center gap-2.5 rounded-[18px] bg-surface px-3 lg:px-4">
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
                className={cn(
                  TOP_BAR_CONTROL,
                  "hidden hover:bg-surface-muted lg:grid",
                )}
              >
                <ArrowLeft className="h-[19px] w-[19px]" strokeWidth={2.2} />
              </button>
            ) : (
              <button
                type="button"
                title={`Back — ${OUT_OF_SCOPE}`}
                className={cn(
                  TOP_BAR_CONTROL,
                  TOP_BAR_INERT,
                  "hidden lg:grid",
                )}
              >
                <ArrowLeft className="h-[19px] w-[19px]" strokeWidth={2.2} />
              </button>
            )}

            <div className="flex min-w-0 items-center gap-2 text-ink-soft">
              <Clipboard className="hidden h-[19px] w-[19px] shrink-0 lg:block" strokeWidth={1.9} />
              <span className="truncate text-[15px] font-medium">{crumb}</span>
            </div>

            <div className="ml-auto flex items-center gap-1.5 lg:gap-3">
              <button
                type="button"
                aria-label="Help"
                title={`Help — ${OUT_OF_SCOPE}`}
                className={cn(TOP_BAR_CONTROL, TOP_BAR_INERT, "hidden lg:grid")}
              >
                <HelpCircle className="h-[21px] w-[21px]" strokeWidth={1.8} />
              </button>

              <button
                type="button"
                aria-label="Notifications"
                title={`Notifications — ${OUT_OF_SCOPE}`}
                className={cn(TOP_BAR_CONTROL, TOP_BAR_INERT, "relative")}
              >
                <Bell className="h-[21px] w-[21px]" strokeWidth={1.8} />
                <span className="absolute right-[7px] top-[7px] h-[7px] w-[7px] rounded-full bg-accent ring-2 ring-white" />
              </button>

              <button
                type="button"
                aria-label="AI assistant"
                title={`AI assistant — ${OUT_OF_SCOPE}`}
                className={cn(TOP_BAR_CONTROL, TOP_BAR_INERT, "hidden lg:grid")}
              >
                {/* Solid four-point star, not lucide's two-star Sparkles. */}
                <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="currentColor" aria-hidden="true">
                  <path d="M12 1.6l2.2 6.4c.3.9 1 1.6 1.9 1.9l6.3 2.1-6.3 2.1c-.9.3-1.6 1-1.9 1.9L12 22.4l-2.2-6.4a3.2 3.2 0 00-1.9-1.9L1.6 12l6.3-2.1c.9-.3 1.6-1 1.9-1.9z" />
                </svg>
              </button>

              <button
                type="button"
                title={`${TEACHER.name} — ${OUT_OF_SCOPE}`}
                className={cn(
                  TOP_BAR_INERT,
                  "flex items-center gap-2 rounded-full py-1 pl-1 pr-1 transition hover:bg-surface-muted lg:pr-2",
                )}
              >
                <span className="grid h-9 w-9 shrink-0 overflow-hidden rounded-full bg-surface-muted ring-1 ring-black/5">
                  <ArtworkImage
                    src={USER_AVATAR}
                    className="h-full w-full object-cover object-center"
                    fallback={
                      <span className="grid h-full w-full place-items-center bg-gradient-to-br from-amber-200 to-orange-300 text-[13px] font-bold text-orange-900">
                        {TEACHER.initials}
                      </span>
                    }
                  />
                </span>
                <span className="hidden text-[14px] font-semibold lg:inline">{TEACHER.name}</span>
                <ChevronDown className="hidden h-4 w-4 text-ink-faint lg:block" />
              </button>
            </div>
          </div>
        </header>
        )}

        {mobileReviewHeader && (
          <MobileReviewHeader onBack={onBack} onOpenMenu={() => setDrawer(true)} />
        )}

        <main className="canvas-gradient min-h-0 flex-1 lg:overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
