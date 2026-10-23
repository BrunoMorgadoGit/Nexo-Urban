import { z } from 'zod';

export const environmentSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    WEB_ORIGIN: z.string().url().default('http://127.0.0.1:4200'),
  })
  .passthrough();

export function validateEnvironment(environment: Record<string, unknown>) {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    ].join(', ');
    throw new Error(`Invalid environment configuration: ${fields}`);
  }

  return result.data;
}
