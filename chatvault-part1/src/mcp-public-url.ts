/**
 * Public origin of the MCP app (HTTPS on Vercel). Used for widget CSP and OpenAI `_meta`.
 *
 * Set `MCP_PUBLIC_URL` in production (e.g. `https://your-app.vercel.app`) when you need a
 * stable canonical origin (custom domain) instead of the default `VERCEL_URL` preview host.
 */
export function getMcpPublicOrigin(): string {
  const explicit = process.env.MCP_PUBLIC_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      /* fall through */
    }
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const withScheme = /^https?:\/\//i.test(vercel)
      ? vercel
      : `https://${vercel}`;
    try {
      return new URL(withScheme).origin;
    } catch {
      /* fall through */
    }
  }

  const port = process.env.PORT ?? "3000";
  return `http://127.0.0.1:${port}`;
}
