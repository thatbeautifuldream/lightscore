// Normalizes user input — a bare host, a domain, or a full URL — into a URL
// Lighthouse can hit. No server is started and nothing is probed.

function hasProtocol(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "[::1]";
}

/**
 * Resolve user input into a full URL:
 * - "https://x.com" / "http://localhost:3000" -> used as-is
 * - "localhost:4000" / "127.0.0.1" -> http://
 * - "milindmishra.com" / "example.com/path" -> https://
 */
export function resolveTarget(input: string): string {
  if (hasProtocol(input)) return input;
  const host = input.split(/[/:]/)[0]!;
  return isLocalHost(host) ? `http://${input}` : `https://${input}`;
}
