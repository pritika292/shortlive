interface MarkProps {
  size?: number;
  className?: string;
}

// Geometric chevron-arrow morphing into a pulse waveform — encodes both
// "short" (the arrow shape) and "live" (the pulse at the right). The mark
// is single-color via currentColor so theme tokens drive the fill.
export function LogoMark({ size = 24, className }: MarkProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="shortlive logo"
      className={className}
    >
      {/* chevron arrow */}
      <path d="M3 21 L12 12 L8 12 L17 3 L17 7 L11 13 L15 13 Z" fill="currentColor" />
      {/* pulse waveform tail */}
      <path
        d="M16 16 L20 16 L21 12 L23 22 L25 14 L27 18 L31 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function LogoLockup({ size = 64 }: { size?: number }): JSX.Element {
  return (
    <div className="inline-flex items-center gap-3 text-slate-900 dark:text-slate-100">
      <LogoMark size={size} className="text-sky-600 dark:text-sky-400" />
      <span className="text-4xl font-semibold tracking-tight">shortlive</span>
    </div>
  );
}
