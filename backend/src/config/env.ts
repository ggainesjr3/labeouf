export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (value) return value;
  if (process.env.NODE_ENV === 'test') return `test-${key}`;
  throw new Error(`Missing required environment variable: ${key}`);
}

export function getCorsOrigins(): string[] | string | boolean {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  if (allowedOrigin === '*') return '*';
  if (allowedOrigin) {
    return allowedOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);
  }
  return ['http://localhost:3000', 'http://localhost:8080'];
}
