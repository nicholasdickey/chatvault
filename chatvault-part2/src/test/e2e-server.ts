import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";

export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      s.close(() => {
        if (addr && typeof addr !== "string") {
          resolve(addr.port);
        } else {
          reject(new Error("Could not allocate port"));
        }
      });
    });
    s.on("error", reject);
  });
}

export async function waitForMcpHealth(
  port: number,
  timeoutMs = 90000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const url = `http://127.0.0.1:${port}/mcp?health=1`;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        const j = (await r.json()) as { ok?: boolean };
        if (j.ok === true) {
          return;
        }
      }
    } catch {
      /* retry */
    }
    await new Promise((res) => setTimeout(res, 200));
  }
  throw new Error(`Health check timed out for ${url}`);
}

export function startNextServer(
  projectRoot: string,
  port: number,
  extraEnv: Record<string, string | undefined>,
): ChildProcess {
  return spawn(
    "pnpm",
    ["exec", "next", "start", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        ...extraEnv,
        NODE_ENV: "production",
        PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}
