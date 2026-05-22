import { useState } from "react";
import { QuickstartModal } from "./QuickstartModal.js";

interface Props {
  // Where to send the user once their playground session is live. Defaults
  // to /create which is the only useful destination right now.
  next?: string;
  // Visual style. "primary" sits on the homepage hero; "secondary" sits on
  // the login page as the alternative to signing in; "compact" fits in the
  // TopBar next to the theme toggle.
  variant?: "primary" | "secondary" | "compact";
  children?: React.ReactNode;
}

export function QuickstartButton({
  next = "/create",
  variant = "primary",
  children,
}: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const label = children ?? "Quickstart (30-min playground)";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "primary"
            ? "inline-flex items-center gap-2 px-7 py-3 rounded-full text-base font-semibold text-white bg-gradient-to-r from-emerald-500 via-cyan-500 to-sky-500 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:brightness-110 transition-all"
            : variant === "compact"
              ? "inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 via-cyan-500 to-sky-500 shadow-md shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:brightness-110 transition-all"
              : "btn-secondary"
        }
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden
        >
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        {label}
      </button>
      {open ? <QuickstartModal next={next} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
