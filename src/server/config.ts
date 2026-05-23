import { z } from "zod";

const DEV_DEFAULT_PEPPER = "dev-only-replace-in-prod";

const ConfigSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  PORT: z.coerce.number().int().positive().default(3010),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 chars"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  IP_HASH_PEPPER: z
    .string()
    .min(16, "IP_HASH_PEPPER must be at least 16 chars")
    .default(DEV_DEFAULT_PEPPER),
  GEOLITE2_PATH: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid config:\n${issues}`);
  }
  // Guard: if NODE_ENV=production and IP_HASH_PEPPER is still the dev
  // default, refuse to boot. Otherwise prod would silently hash visitor
  // IPs with a predictable pepper across every install that forgot to
  // populate the env var.
  if (result.data.NODE_ENV === "production" && result.data.IP_HASH_PEPPER === DEV_DEFAULT_PEPPER) {
    throw new Error(
      "Invalid config:\n  - IP_HASH_PEPPER must be set to a real value in production (currently the dev default)",
    );
  }
  return result.data;
}

let cached: Config | undefined;

export function config(): Config {
  if (!cached) cached = loadConfig();
  return cached;
}
