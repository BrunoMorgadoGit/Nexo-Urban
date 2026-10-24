export type E2eDatabaseTarget = {
  host: string;
  port: string;
  database: string;
  username: string;
};

export function validateE2eConfiguration(
  environment: Record<string, string | undefined>,
): E2eDatabaseTarget;
