import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.string().default("info"),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  DEVICE_KEYS: z.string().default(""),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_IMAGE_DETAIL: z.enum(["low", "high", "auto"]).default("low"),
  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(400),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),

  OPENAI_BUDGET_USD: z.coerce.number().nonnegative().default(1),
  OPENAI_INPUT_PRICE_PER_1M: z.coerce.number().nonnegative().default(0.15),
  OPENAI_OUTPUT_PRICE_PER_1M: z.coerce.number().nonnegative().default(0.6),

  DEFAULT_ANALYSIS_INTERVAL_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(30),
  FRAME_STALE_FACTOR: z.coerce.number().positive().default(2),

  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 1024 * 1024),
});

export type AppConfig = z.infer<typeof envSchema> & {
  /** clave del dispositivo -> id del dispositivo */
  deviceKeys: Map<string, string>;
};

function parseDeviceKeys(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const id = trimmed.slice(0, idx).trim();
    const key = trimmed.slice(idx + 1).trim();
    if (id && key) map.set(key, id);
  }
  return map;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  return { ...parsed, deviceKeys: parseDeviceKeys(parsed.DEVICE_KEYS) };
}
