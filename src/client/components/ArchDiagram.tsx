// Hand-positioned SVG diagram of the shortlive request topology.
// Sized for a full-width About section (not a narrow column) so labels
// and edges read cleanly without zooming.

export function ArchDiagram(): JSX.Element {
  return (
    <svg
      viewBox="0 0 960 460"
      className="block w-full h-auto"
      role="img"
      aria-label="shortlive flow: visitor follows a short URL; the hot redirect path returns 302 fast, asynchronously enqueueing the click; an async worker writes to Postgres and pushes a click event via Redis pub/sub, which a WebSocket fan-out delivers to live dashboards."
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" className="fill-slate-500" />
        </marker>
      </defs>

      {/* Visitor */}
      <Box x={20} y={40} w={200} h={70} label="visitor" subLabel="GET /:short" />

      {/* Express :3010 (hot path) */}
      <Box
        x={290}
        y={40}
        w={240}
        h={70}
        label="Express :3010"
        subLabel="redirect · 302 · sub-ms"
        accent
      />

      {/* Async click queue */}
      <Box x={290} y={150} w={240} h={70} label="click queue" subLabel="async · fail-soft" />

      {/* Click worker */}
      <Box x={290} y={260} w={240} h={70} label="click worker" subLabel="writes + publishes" />

      {/* Postgres */}
      <Box x={600} y={150} w={340} h={54} label="Postgres 16" subLabel="links · clicks · rules" />

      {/* Redis pub/sub */}
      <Box x={600} y={220} w={340} h={54} label="Redis pub/sub" subLabel="<1s click fan-out" />

      {/* WebSocket hub */}
      <Box x={290} y={360} w={240} h={70} label="WebSocket hub" subLabel="dashboard fan-out" />

      {/* Dashboard */}
      <Box
        x={600}
        y={360}
        w={340}
        h={70}
        label="live dashboard"
        subLabel="<1s click updates"
        dashed
      />

      {/* Rules + webhooks side flow */}
      <Box x={20} y={260} w={200} h={70} label="rules" subLabel="HMAC · backoff · DLQ" dashed />

      {/* Edges */}
      <Edge from={[220, 75]} to={[290, 75]} />
      <Edge from={[410, 110]} to={[410, 150]} dashed />
      <Edge from={[410, 220]} to={[410, 260]} />
      <Edge from={[530, 285]} to={[600, 180]} />
      <Edge from={[530, 295]} to={[600, 247]} />
      <Edge from={[770, 274]} to={[770, 360]} />
      <Edge from={[410, 330]} to={[410, 360]} dashed />
      <Edge from={[530, 395]} to={[600, 395]} dashed />
      <Edge from={[220, 295]} to={[290, 295]} dashed />

      {/* Caption */}
      <text
        x={480}
        y={445}
        textAnchor="middle"
        className="fill-slate-500 dark:fill-slate-400 font-mono"
        fontSize={13}
      >
        ── solid: hot path - - dashed: async + side flows
      </text>
    </svg>
  );
}

function Box({
  x,
  y,
  w,
  h,
  label,
  subLabel,
  accent = false,
  dashed = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  subLabel?: string;
  accent?: boolean;
  dashed?: boolean;
}): JSX.Element {
  const stroke = accent
    ? "stroke-emerald-500"
    : dashed
      ? "stroke-slate-300 dark:stroke-slate-700"
      : "stroke-slate-400 dark:stroke-slate-600";
  const dashAttr = dashed ? "6 4" : undefined;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        ry={6}
        className={`fill-transparent ${stroke}`}
        strokeWidth={1.5}
        strokeDasharray={dashAttr}
      />
      <text
        x={x + w / 2}
        y={subLabel === undefined ? y + h / 2 + 6 : y + h / 2 - 4}
        textAnchor="middle"
        className={
          accent
            ? "fill-emerald-600 dark:fill-emerald-400 font-mono"
            : "fill-slate-900 dark:fill-white font-mono"
        }
        fontSize={accent ? 18 : 16}
        fontWeight={accent ? 600 : 500}
      >
        {label}
      </text>
      {subLabel !== undefined && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 16}
          textAnchor="middle"
          className="fill-slate-500 dark:fill-slate-400 font-mono"
          fontSize={12}
        >
          {subLabel}
        </text>
      )}
    </g>
  );
}

function Edge({
  from,
  to,
  dashed = false,
}: {
  from: [number, number];
  to: [number, number];
  dashed?: boolean;
}): JSX.Element {
  const dashAttr = dashed ? "6 4" : undefined;
  return (
    <line
      x1={from[0]}
      y1={from[1]}
      x2={to[0]}
      y2={to[1]}
      className="stroke-slate-500"
      strokeWidth={1.75}
      strokeDasharray={dashAttr}
      markerEnd="url(#arrow)"
    />
  );
}
