// Dense distributed-systems topology for the shortlive About page.
// Plain SVG. Boxes grouped by tier with a VM "subgraph" frame so the
// picture reads as real infrastructure, not a marketing flowchart.
//
// Box helper auto-wraps long sub-labels at the " · " separator and
// stretches the rect to fit additional lines. Each box can carry a
// `tone` prop tinting stroke + label in the site's emerald / sky /
// cyan / amber / violet / rose palette so the tier rhythm reads at
// a glance.

type Tone = "accent" | "edge" | "hot" | "async" | "data" | "auth" | "deploy" | "neutral";

const TONE: Record<Tone, { stroke: string; label: string }> = {
  accent: {
    stroke: "stroke-emerald-500",
    label: "fill-emerald-600 dark:fill-emerald-400",
  },
  edge: {
    stroke: "stroke-sky-500 dark:stroke-sky-400",
    label: "fill-sky-700 dark:fill-sky-300",
  },
  hot: {
    stroke: "stroke-emerald-500 dark:stroke-emerald-400",
    label: "fill-emerald-700 dark:fill-emerald-300",
  },
  async: {
    stroke: "stroke-amber-500 dark:stroke-amber-400",
    label: "fill-amber-700 dark:fill-amber-300",
  },
  data: {
    stroke: "stroke-cyan-500 dark:stroke-cyan-400",
    label: "fill-cyan-700 dark:fill-cyan-300",
  },
  auth: {
    stroke: "stroke-violet-500 dark:stroke-violet-400",
    label: "fill-violet-700 dark:fill-violet-300",
  },
  deploy: {
    stroke: "stroke-rose-500 dark:stroke-rose-400",
    label: "fill-rose-700 dark:fill-rose-300",
  },
  neutral: {
    stroke: "stroke-slate-400 dark:stroke-slate-600",
    label: "fill-slate-900 dark:fill-white",
  },
};

const SUB_FONT_SIZE = 11;

function wrapSub(sub: string, w: number): string[] {
  const charBudget = Math.floor((w - 16) / (SUB_FONT_SIZE * 0.55));
  if (sub.length <= charBudget) return [sub];
  const tokens = sub.split(" · ");
  if (tokens.length === 1) return [sub];
  const lines: string[] = [];
  let cur = "";
  for (const t of tokens) {
    const next = cur ? `${cur} · ${t}` : t;
    if (next.length <= charBudget) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = t;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function ArchDiagram(): JSX.Element {
  return (
    <svg
      viewBox="0 0 1200 760"
      className="block w-full h-auto"
      role="img"
      aria-label="shortlive architecture: visitor hits Caddy on an Azure VM, the redirect handler responds in under 50ms and asynchronously enqueues a click; a click worker writes Postgres + publishes to Redis pub/sub, a WebSocket hub fans out to dashboards, and a rule engine drains a BullMQ webhook queue with HMAC, exponential backoff, and a dead-letter queue."
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

      {/* External (left) */}
      <GroupLabel x={100} y={32} label="EXTERNAL" />
      <Box x={20} y={50} w={200} h={56} label="visitor" sub="GET /:short" />
      <Box
        x={20}
        y={130}
        w={200}
        h={56}
        label="dashboard tabs"
        sub="WebSocket subscribers"
        dashed
      />
      <Box
        x={20}
        y={210}
        w={200}
        h={56}
        label="webhook receivers"
        sub="POST + HMAC verify"
        dashed
      />
      <Box
        x={20}
        y={290}
        w={200}
        h={56}
        label="MaxMind GeoLite2"
        sub="country + continent enrich"
        dashed
      />
      <Box x={20} y={370} w={200} h={56} label="GitHub Actions" sub="OIDC token exchange" dashed />

      {/* VM subgraph */}
      <VmFrame x={280} y={20} w={620} h={720} label="Azure VM · B2as_v2 · northcentralus" />

      {/* Edge: Caddy */}
      <GroupLabel x={420} y={62} label="EDGE" />
      <Box
        x={310}
        y={80}
        w={220}
        h={56}
        label="Caddy"
        sub="TLS · shortlive.pritika.studio"
        tone="edge"
      />

      {/* Express tier */}
      <GroupLabel x={420} y={170} label="APP · shortlive :3010" />
      <Box
        x={310}
        y={190}
        w={220}
        h={62}
        label="Express 5 · Node 20"
        sub="helmet · rate-limit · sessions"
        tone="accent"
      />

      {/* Hot path */}
      <GroupLabel x={420} y={280} label="HOT PATH · sub-50ms" />
      <Box
        x={310}
        y={300}
        w={220}
        h={56}
        label="redirect handler"
        sub="SELECT target · 302 · setImmediate"
        tone="hot"
      />

      {/* Async pipeline */}
      <GroupLabel x={420} y={380} label="ASYNC PIPELINE · off the hot path" />
      <Box
        x={310}
        y={400}
        w={220}
        h={50}
        label="click queue"
        sub="setImmediate · fail-soft"
        tone="async"
        dashed
      />
      <Box
        x={310}
        y={460}
        w={220}
        h={50}
        label="click worker"
        sub="INSERT · ZADD · PUBLISH"
        tone="async"
      />
      <Box
        x={310}
        y={520}
        w={220}
        h={50}
        label="rule engine"
        sub="threshold · velocity · per-click"
        tone="async"
      />
      <Box
        x={310}
        y={580}
        w={220}
        h={50}
        label="webhook worker"
        sub="BullMQ · 5 tries · DLQ"
        tone="async"
      />
      <Box
        x={310}
        y={640}
        w={220}
        h={48}
        label="WebSocket hub"
        sub="ws · subscribe-before-hydrate"
        tone="async"
      />

      {/* Data plane */}
      <GroupLabel x={730} y={62} label="DATA PLANE · pritika network" />
      <Box
        x={620}
        y={80}
        w={260}
        h={74}
        label="Postgres 16"
        sub="urls · clicks · rules · firings · sessions · auth.users"
        tone="data"
      />
      <Box
        x={620}
        y={180}
        w={260}
        h={60}
        label="Redis 7 · pub/sub"
        sub="shortlive:clicks.{short} · <1s fan-out"
        tone="data"
      />
      <Box
        x={620}
        y={260}
        w={260}
        h={56}
        label="Redis ZSET"
        sub="recent_clicks:{short} · capped 100"
        tone="data"
      />
      <Box
        x={620}
        y={340}
        w={260}
        h={56}
        label="BullMQ queue"
        sub="firing_id idempotency · backoff"
        tone="data"
      />

      {/* Auth + identity */}
      <GroupLabel x={730} y={420} label="AUTH" />
      <Box
        x={620}
        y={440}
        w={260}
        h={52}
        label="session middleware"
        sub="HttpOnly cookie · sid"
        tone="auth"
        dashed
      />
      <Box
        x={620}
        y={510}
        w={260}
        h={56}
        label="auth.users (shared)"
        sub="ON DELETE CASCADE · sweeper 5m"
        tone="auth"
        dashed
      />

      {/* Secrets + deploy */}
      <GroupLabel x={730} y={580} label="SECRETS · DEPLOY" />
      <Box
        x={620}
        y={600}
        w={260}
        h={48}
        label="Managed Identity"
        sub="VM system-assigned"
        tone="deploy"
        dashed
      />
      <Box
        x={620}
        y={660}
        w={260}
        h={56}
        label="Azure Key Vault"
        sub="Postgres + Redis creds · boot"
        tone="deploy"
        dashed
      />

      {/* Right edge: control plane */}
      <GroupLabel x={1020} y={32} label="CONTROL PLANE" />
      <Box
        x={920}
        y={50}
        w={260}
        h={56}
        label="GitHub · pritika292/shortlive"
        sub="ci · deploy · OIDC"
        tone="deploy"
        dashed
      />
      <Box
        x={920}
        y={120}
        w={260}
        h={56}
        label="Azure Entra ID"
        sub="federated identity credential"
        tone="deploy"
        dashed
      />
      <Box
        x={920}
        y={190}
        w={260}
        h={56}
        label="Azure RBAC"
        sub="VM Contributor · 1 VM"
        tone="deploy"
        dashed
      />
      <Box
        x={920}
        y={260}
        w={260}
        h={56}
        label="az vm run-command"
        sub="git pull · compose up"
        tone="deploy"
        dashed
      />

      {/* Edges */}
      <Edge from={[220, 78]} to={[310, 108]} />
      <Edge from={[420, 136]} to={[420, 190]} />

      {/* Express -> redirect handler */}
      <Edge from={[420, 252]} to={[420, 300]} />

      {/* redirect handler -> click queue (setImmediate) */}
      <Edge from={[420, 356]} to={[420, 400]} dashed />

      {/* click queue -> click worker */}
      <Edge from={[420, 450]} to={[420, 460]} />

      {/* click worker -> Postgres + Redis pub/sub + ZSET */}
      <Edge from={[530, 470]} to={[620, 117]} />
      <Edge from={[530, 480]} to={[620, 210]} />
      <Edge from={[530, 490]} to={[620, 288]} />

      {/* click worker -> rule engine */}
      <Edge from={[420, 510]} to={[420, 520]} />

      {/* rule engine -> BullMQ queue */}
      <Edge from={[530, 545]} to={[620, 368]} />

      {/* BullMQ queue -> webhook worker -> external receivers */}
      <Edge from={[620, 368]} to={[530, 605]} />
      <Edge from={[310, 605]} to={[220, 238]} dashed />

      {/* Redis pub/sub -> WS hub -> dashboards */}
      <Edge from={[620, 210]} to={[530, 661]} />
      <Edge from={[310, 661]} to={[220, 158]} dashed />

      {/* Express -> sessions / auth */}
      <Edge from={[530, 220]} to={[620, 466]} dashed />

      {/* Click worker -> GeoLite2 enrichment */}
      <Edge from={[310, 485]} to={[220, 318]} dashed />

      {/* MI -> Key Vault (boot) */}
      <Edge from={[750, 648]} to={[750, 660]} dashed />
      <Edge from={[530, 235]} to={[620, 624]} dashed />

      {/* Deploy: GitHub -> OIDC -> RBAC -> run-command -> Express */}
      <Edge from={[920, 78]} to={[920, 148]} dashed />
      <Edge from={[920, 148]} to={[920, 218]} dashed />
      <Edge from={[920, 218]} to={[920, 288]} dashed />
      <Edge from={[920, 288]} to={[530, 240]} dashed />

      {/* Caption */}
      <text
        x={600}
        y={742}
        textAnchor="middle"
        className="fill-slate-500 dark:fill-slate-400 font-mono"
        fontSize={13}
      >
        ── solid: synchronous request / queue write - - dashed: async push · enrichment · auth ·
        deploy
      </text>
    </svg>
  );
}

function GroupLabel({ x, y, label }: { x: number; y: number; label: string }): JSX.Element {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      className="fill-slate-500 dark:fill-slate-400 font-mono uppercase"
      fontSize={11}
      letterSpacing={2}
    >
      {label}
    </text>
  );
}

function VmFrame({
  x,
  y,
  w,
  h,
  label,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}): JSX.Element {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        ry={10}
        className="fill-transparent stroke-slate-300 dark:stroke-slate-700"
        strokeWidth={1}
        strokeDasharray="2 3"
      />
      <text
        x={x + 14}
        y={y + 14}
        className="fill-slate-500 dark:fill-slate-400 font-mono uppercase"
        fontSize={10}
        letterSpacing={2}
      >
        {label}
      </text>
    </g>
  );
}

function Box({
  x,
  y,
  w,
  h,
  label,
  sub,
  tone = "neutral",
  dashed = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  tone?: Tone;
  dashed?: boolean;
}): JSX.Element {
  const subLines = sub ? wrapSub(sub, w) : [];
  const extraHeight = Math.max(0, (subLines.length - 1) * 12);
  const rectH = h + extraHeight;
  const palette = TONE[tone];
  const isAccent = tone === "accent";
  const strokeClass =
    dashed && tone === "neutral" ? "stroke-slate-300 dark:stroke-slate-700" : palette.stroke;
  const dashAttr = dashed ? "6 4" : undefined;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={rectH}
        rx={6}
        ry={6}
        className={`fill-transparent ${strokeClass}`}
        strokeWidth={isAccent ? 1.75 : 1.5}
        strokeDasharray={dashAttr}
      />
      <text
        x={x + w / 2}
        y={sub ? y + h / 2 - 4 : y + h / 2 + 5}
        textAnchor="middle"
        className={`${palette.label} font-mono`}
        fontSize={isAccent ? 16 : 14}
        fontWeight={isAccent ? 600 : 500}
      >
        {label}
      </text>
      {subLines.map((line, i) => (
        <text
          key={i}
          x={x + w / 2}
          y={y + h / 2 + 14 + i * 12}
          textAnchor="middle"
          className="fill-slate-500 dark:fill-slate-400 font-mono"
          fontSize={SUB_FONT_SIZE}
        >
          {line}
        </text>
      ))}
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
      strokeWidth={1.5}
      strokeDasharray={dashAttr}
      markerEnd="url(#arrow)"
    />
  );
}
