import { z } from "zod";

const ConfigSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  PORT: z.coerce.number().int().positive().default(3010),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 chars"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  IP_HASH_PEPPER: z
    .string()
    .min(16, "IP_HASH_PEPPER must be at least 16 chars")
    .default("dev-only-replace-in-prod"),
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
  return result.data;
}

let cached: Config | undefined;

export function config(): Config {
  if (!cached) cached = loadConfig();
  return cached;
}
