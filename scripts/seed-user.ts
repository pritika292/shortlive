import "dotenv/config";
import { parseArgs } from "node:util";
import pg from "pg";
import { hash } from "../src/server/services/passwords.js";
import { loadConfig } from "../src/server/config.js";

interface Args {
  username: string;
  password: string;
  displayName?: string;
  update: boolean;
}

function parse(argv: string[]): Args {
  const { values } = parseArgs({
    args: argv,
    options: {
      username: { type: "string", short: "u" },
      password: { type: "string", short: "p" },
      "display-name": { type: "string" },
      update: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
  });

  if (values.help) {
    console.log(
      "Usage: seed-user --username <name> --password <pw> [--display-name <text>] [--update]\n" +
        "\n" +
        "Idempotent: re-running with the same username is a no-op unless --update is passed.",
    );
    process.exit(0);
  }
  if (!values.username || !values.password) {
    console.error("ERROR: --username and --password are required (try --help)");
    process.exit(2);
  }
  return {
    username: values.username,
    password: values.password,
    displayName: values["display-name"],
    update: values.update ?? false,
  };
}

export async function seedUser(
  client: pg.ClientBase,
  args: Args,
): Promise<{ inserted: boolean; updated: boolean }> {
  const passwordHash = await hash(args.password);
  const { rows: existing } = await client.query<{ id: string }>(
    "SELECT id FROM auth.users WHERE username = $1",
    [args.username],
  );

  if (existing.length === 0) {
    await client.query(
      `INSERT INTO auth.users(username, password_hash, display_name) VALUES($1, $2, $3)`,
      [args.username, passwordHash, args.displayName ?? null],
    );
    return { inserted: true, updated: false };
  }
  if (!args.update) {
    return { inserted: false, updated: false };
  }
  await client.query(
    `UPDATE auth.users SET password_hash = $2, display_name = COALESCE($3, display_name)
       WHERE username = $1`,
    [args.username, passwordHash, args.displayName ?? null],
  );
  return { inserted: false, updated: true };
}

async function main(): Promise<void> {
  const args = parse(process.argv.slice(2));
  const cfg = loadConfig();
  const client = new pg.Client({ connectionString: cfg.DATABASE_URL });
  await client.connect();
  try {
    const result = await seedUser(client, args);
    if (result.inserted) {
      console.log(`Created user ${args.username}`);
    } else if (result.updated) {
      console.log(`Updated user ${args.username}`);
    } else {
      console.log(`User ${args.username} already exists; pass --update to rewrite the password`);
    }
  } finally {
    await client.end();
  }
}

const isMain =
  process.argv[1]?.endsWith("seed-user.ts") || process.argv[1]?.endsWith("seed-user.js");
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
