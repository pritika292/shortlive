// Hand-positioned SVG diagram of the shortlive request topology (#152).
// React Flow would be overkill for one static About-page diagram; plain
// SVG keeps the bundle small and tracks the dark theme for free.

export function ArchDiagram(): JSX.Element {
  return (
    <svg
      viewBox="0 0 540 320"
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
      <Box x={10} y={10} w={120} h={50} label="visitor" subLabel="GET /:short" />

      {/* Express */}
      <Box
        x={200}
        y={10}
        w={140}
        h={50}
        label="Express :3010"
        subLabel="redirect hot path"
        accent
      />

      {/* Async click queue → worker */}
      <Box x={200} y={90} w={140} h={50} label="click queue" subLabel="async, fail-soft" />
      <Box x={200} y={170} w={140} h={50} label="click worker" subLabel="writes + publishes" />

      {/* Postgres + Redis */}
      <Box x={390} y={170} w={140} h={28} label="Postgres 16" />
      <Box x={390} y={210} w={140} h={28} label="Redis pub/sub" />

      {/* WebSocket fan-out */}
      <Box x={200} y={250} w={140} h={50} label="WebSocket hub" subLabel="dashboard fan-out" />

      {/* Dashboard */}
      <Box x={390} y={250} w={140} h={50} label="dashboard" subLabel="<1s click updates" dashed />

      {/* Rules + webhooks side flow */}
      <Box x={10} y={170} w={120} h={50} label="rules" subLabel="HMAC + retries" dashed />

      {/* Edges */}
      <Edge from={[130, 35]} to={[200, 35]} />
      <Edge from={[270, 60]} to={[270, 90]} dashed />
      <Edge from={[270, 140]} to={[270, 170]} />
      <Edge from={[340, 184]} to={[390, 184]} />
      <Edge from={[340, 195]} to={[390, 224]} />
      <Edge from={[460, 224]} to={[460, 250]} />
      <Edge from={[270, 220]} to={[270, 250]} dashed />
      <Edge from={[340, 275]} to={[390, 275]} dashed />
      <Edge from={[130, 195]} to={[200, 195]} dashed />

      {/* Caption */}
      <text x={270} y={310} textAnchor="middle" className="fill-slate-500 font-mono" fontSize={10}>
        ── solid: hot path · - - dashed: async + side flows
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
  const dashAttr = dashed ? "4 3" : undefined;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={3}
        ry={3}
        className={`fill-transparent ${stroke}`}
        strokeWidth={1}
        strokeDasharray={dashAttr}
      />
      <text
        x={x + w / 2}
        y={subLabel === undefined ? y + h / 2 + 4 : y + h / 2 - 1}
        textAnchor="middle"
        className={
          accent
            ? "fill-emerald-600 dark:fill-emerald-400 font-mono"
            : "fill-slate-900 dark:fill-white font-mono"
        }
        fontSize={11}
      >
        {label}
      </text>
      {subLabel !== undefined && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 12}
          textAnchor="middle"
          className="fill-slate-500 dark:fill-slate-400 font-mono"
          fontSize={9}
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
  const dashAttr = dashed ? "4 3" : undefined;
  return (
    <line
      x1={from[0]}
      y1={from[1]}
      x2={to[0]}
      y2={to[1]}
      className="stroke-slate-500"
      strokeWidth={1}
      strokeDasharray={dashAttr}
      markerEnd="url(#arrow)"
    />
  );
}
