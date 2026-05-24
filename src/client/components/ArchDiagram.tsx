// Dense distributed-systems topology for the shortlive About page.
// Plain SVG. Boxes grouped by tier with a VM "subgraph" frame so the
// picture reads as real infrastructure, not a marketing flowchart.

export function ArchDiagram(): JSX.Element {
  return (
    <svg
      viewBox="0 0 1200 720"
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
      <Box x={20} y={50} w={200} h={56} label="visitor" subLabel="GET /:short" />
      <Box
        x={20}
        y={130}
        w={200}
        h={56}
        label="dashboard tabs"
        subLabel="WebSocket subscribers"
        dashed
      />
      <Box
        x={20}
        y={210}
        w={200}
        h={56}
        label="webhook receivers"
        subLabel="POST + HMAC verify"
        dashed
      />
      <Box
        x={20}
        y={290}
        w={200}
        h={56}
        label="MaxMind GeoLite2"
        subLabel="country + continent enrich"
        dashed
      />
      <Box
        x={20}
        y={370}
        w={200}
        h={56}
        label="GitHub Actions"
        subLabel="OIDC token exchange"
        dashed
      />

      {/* VM subgraph */}
      <VmFrame x={280} y={20} w={620} h={680} label="Azure VM · B2as_v2 · northcentralus" />

      {/* Edge: Caddy */}
      <GroupLabel x={420} y={62} label="EDGE" />
      <Box x={310} y={80} w={220} h={56} label="Caddy" subLabel="TLS · shortlive.pritika.studio" />

      {/* Express tier */}
      <GroupLabel x={420} y={170} label="APP · shortlive :3010" />
      <Box
        x={310}
        y={190}
        w={220}
        h={62}
        label="Express 5 · Node 20"
        subLabel="helmet · rate-limit · sessions"
        accent
      />

      {/* Hot path */}
      <GroupLabel x={420} y={280} label="HOT PATH · sub-50ms" />
      <Box
        x={310}
        y={300}
        w={220}
        h={56}
        label="redirect handler"
        subLabel="SELECT target · 302 · setImmediate"
        accent
      />

      {/* Async pipeline */}
      <GroupLabel x={420} y={380} label="ASYNC PIPELINE · off the hot path" />
      <Box
        x={310}
        y={400}
        w={220}
        h={50}
        label="click queue"
        subLabel="setImmediate · fail-soft"
        dashed
      />
      <Box x={310} y={460} w={220} h={50} label="click worker" subLabel="INSERT · ZADD · PUBLISH" />
      <Box
        x={310}
        y={520}
        w={220}
        h={50}
        label="rule engine"
        subLabel="threshold · velocity · per-click"
      />
      <Box
        x={310}
        y={580}
        w={220}
        h={50}
        label="webhook worker"
        subLabel="BullMQ · 5 tries · DLQ"
      />
      <Box
        x={310}
        y={640}
        w={220}
        h={42}
        label="WebSocket hub"
        subLabel="ws · subscribe-before-hydrate"
      />

      {/* Data plane */}
      <GroupLabel x={730} y={62} label="DATA PLANE · pritika network" />
      <Box
        x={620}
        y={80}
        w={260}
        h={70}
        label="Postgres 16"
        subLabel="urls · clicks · rules · firings · sessions · auth.users"
      />
      <Box
        x={620}
        y={170}
        w={260}
        h={56}
        label="Redis 7 · pub/sub"
        subLabel="shortlive:clicks.{short} · <1s fan-out"
      />
      <Box
        x={620}
        y={250}
        w={260}
        h={56}
        label="Redis ZSET"
        subLabel="recent_clicks:{short} · capped 100"
      />
      <Box
        x={620}
        y={330}
        w={260}
        h={56}
        label="BullMQ queue"
        subLabel="firing_id idempotency · backoff"
      />

      {/* Auth + identity */}
      <GroupLabel x={730} y={420} label="AUTH" />
      <Box
        x={620}
        y={440}
        w={260}
        h={50}
        label="session middleware"
        subLabel="HttpOnly cookie · sid"
        dashed
      />
      <Box
        x={620}
        y={500}
        w={260}
        h={50}
        label="auth.users (shared)"
        subLabel="ON DELETE CASCADE · sweeper 5m"
        dashed
      />

      {/* Secrets + deploy */}
      <GroupLabel x={730} y={570} label="SECRETS · DEPLOY" />
      <Box
        x={620}
        y={590}
        w={260}
        h={48}
        label="Managed Identity"
        subLabel="VM system-assigned"
        dashed
      />
      <Box
        x={620}
        y={648}
        w={260}
        h={48}
        label="Azure Key Vault"
        subLabel="Postgres + Redis creds · boot"
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
        subLabel="ci · deploy · OIDC"
        dashed
      />
      <Box
        x={920}
        y={120}
        w={260}
        h={56}
        label="Azure Entra ID"
        subLabel="federated identity credential"
        dashed
      />
      <Box
        x={920}
        y={190}
        w={260}
        h={56}
        label="Azure RBAC"
        subLabel="VM Contributor · 1 VM"
        dashed
      />
      <Box
        x={920}
        y={260}
        w={260}
        h={56}
        label="az vm run-command"
        subLabel="git pull · compose up"
        dashed
      />

      {/* Edges */}
      {/* Visitor -> Caddy -> Express */}
      <Edge from={[220, 78]} to={[310, 108]} />
      <Edge from={[420, 138]} to={[420, 190]} />

      {/* Express -> redirect handler */}
      <Edge from={[420, 252]} to={[420, 300]} />

      {/* redirect handler -> click queue (setImmediate) */}
      <Edge from={[420, 356]} to={[420, 400]} dashed />

      {/* click queue -> click worker */}
      <Edge from={[420, 450]} to={[420, 460]} />

      {/* click worker -> Postgres + Redis pub/sub + ZSET */}
      <Edge from={[530, 470]} to={[620, 115]} />
      <Edge from={[530, 480]} to={[620, 198]} />
      <Edge from={[530, 490]} to={[620, 278]} />

      {/* click worker -> rule engine */}
      <Edge from={[420, 510]} to={[420, 520]} />

      {/* rule engine -> BullMQ queue */}
      <Edge from={[530, 545]} to={[620, 358]} />

      {/* BullMQ queue -> webhook worker -> external receivers */}
      <Edge from={[620, 358]} to={[530, 605]} />
      <Edge from={[310, 605]} to={[220, 238]} dashed />

      {/* Redis pub/sub -> WS hub -> dashboards */}
      <Edge from={[620, 198]} to={[530, 661]} />
      <Edge from={[310, 661]} to={[220, 158]} dashed />

      {/* Express -> sessions / auth */}
      <Edge from={[530, 220]} to={[620, 465]} dashed />

      {/* Click worker -> GeoLite2 (enrichment lookup, in-proc but external db file conceptually) */}
      <Edge from={[310, 485]} to={[220, 318]} dashed />

      {/* MI -> Key Vault (boot) */}
      <Edge from={[750, 638]} to={[750, 648]} dashed />
      <Edge from={[530, 235]} to={[620, 614]} dashed />

      {/* Deploy: GitHub -> OIDC -> RBAC -> run-command -> Express */}
      <Edge from={[920, 78]} to={[920, 148]} dashed />
      <Edge from={[920, 148]} to={[920, 218]} dashed />
      <Edge from={[920, 218]} to={[920, 288]} dashed />
      <Edge from={[920, 288]} to={[530, 240]} dashed />

      {/* Caption */}
      <text
        x={600}
        y={710}
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
        y={subLabel === undefined ? y + h / 2 + 5 : y + h / 2 - 4}
        textAnchor="middle"
        className={
          accent
            ? "fill-emerald-600 dark:fill-emerald-400 font-mono"
            : "fill-slate-900 dark:fill-white font-mono"
        }
        fontSize={accent ? 16 : 14}
        fontWeight={accent ? 600 : 500}
      >
        {label}
      </text>
      {subLabel !== undefined && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 14}
          textAnchor="middle"
          className="fill-slate-500 dark:fill-slate-400 font-mono"
          fontSize={11}
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
      strokeWidth={1.5}
      strokeDasharray={dashAttr}
      markerEnd="url(#arrow)"
    />
  );
}
