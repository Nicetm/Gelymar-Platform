const STATIC_CONNECT_SRCS = [
  "'self'",
  'http://localhost:*',
  'http://backend:*',
  'https://api.gelymar.com',
  'ws://localhost:*',
  'wss://localhost:*',
  'https://cdn.socket.io',
  'https://unpkg.com',
  'https://static.cloudflareinsights.com',
  'https://cloudflareinsights.com'
];

export const SCRIPT_SRC_DIRECTIVES = [
  "'self'",
  "'unsafe-inline'",
  "'unsafe-eval'",
  'https://cdn.jsdelivr.net',
  'https://unpkg.com',
  'https://cdn.socket.io',
  'https://www.google.com/recaptcha/',
  'https://www.gstatic.com/recaptcha/',
  'https://static.cloudflareinsights.com'
];

const WS_PROTOCOL_MAP: Record<string, string> = {
  'https:': 'wss:',
  'http:': 'ws:'
};

export function toOrigin(urlString: string): string {
  try {
    return new URL(urlString).origin;
  } catch {
    return '';
  }
}

export function toWs(urlString: string): string {
  try {
    const url = new URL(urlString);
    url.protocol = WS_PROTOCOL_MAP[url.protocol] ?? url.protocol;
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}

export function buildConnectSrc(apiPublic?: string, frontendPublic?: string): string {
  const dynamicEntries = [
    toOrigin(apiPublic ?? ''),
    toWs(apiPublic ?? ''),
    toOrigin(frontendPublic ?? ''),
    toWs(frontendPublic ?? '')
  ].filter(Boolean);

  return [...STATIC_CONNECT_SRCS, ...dynamicEntries].join(' ');
}
