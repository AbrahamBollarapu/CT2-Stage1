export type ServiceConfig = {
  serviceName: string;
  host: string;
  port: number;
};

function getEnv(name: string, fallback?: string): string {
  const v = process.env[name];
  return (v === undefined || v === '') ? (fallback ?? '') : v;
}

export const config: ServiceConfig = {
  serviceName: getEnv('SERVICE_NAME', 'carbon-points-rules-service'),
  host: getEnv('HOST', '0.0.0.0'),
  port: Number(getEnv('PORT', '8000')),
};
