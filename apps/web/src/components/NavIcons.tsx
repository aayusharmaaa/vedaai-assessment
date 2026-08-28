import { cn } from "@/lib/cn";

export type NavIconId = "home" | "classroom" | "assignments" | "exams" | "library";

const SECONDARY = "rgba(94, 94, 94, 0.8)";

const NAV_ICON_SRC: Record<Exclude<NavIconId, "exams">, string> = {
  home: "/nav/home.png",
  classroom: "/nav/classroom.png",
  assignments: "/nav/assignments.png",
  library: "/nav/library.png",
};

/** Figma Exams icon — 20×20, body #303030 + clip #000000 when active. */
function ExamsNavIcon({ active }: { active?: boolean }) {
  const body = active ? "#303030" : SECONDARY;
  const clip = active ? "#000000" : SECONDARY;

  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className="h-5 w-5 shrink-0 flex-none"
    >
      {/* Vector — left/right/top/bottom 16.67% / 16.67% / 16.67% / 8.33% */}
      <rect
        x="4"
        y="4"
        width="12"
        height="14"
        stroke={body}
        strokeWidth="2"
      />
      <rect
        x="7"
        y="2"
        width="6"
        height="3"
        stroke={clip}
        strokeWidth="2"
      />
    </svg>
  );
}

export function NavIcon({ id, active }: { id: NavIconId; active?: boolean }) {
  if (id === "exams") return <ExamsNavIcon active={active} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={NAV_ICON_SRC[id]}
      alt=""
      aria-hidden
      draggable={false}
      className={cn(
        "h-5 w-5 shrink-0 flex-none object-contain",
        active && "brightness-0 saturate-100",
      )}
    />
  );
}
