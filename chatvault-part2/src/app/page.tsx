import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <p className={styles.eyebrow}>ChatVault tutorial · Part 2</p>
        <div className={styles.intro}>
          <h1>Backend MCP server</h1>
          <p className={styles.lead}>
            This app is the <strong>Part 2</strong> companion to the ChatVault series: a
            production-shaped backend that speaks the{" "}
            <strong>Model Context Protocol (MCP)</strong> over HTTP so hosts like ChatGPT
            can call tools such as saving chats, loading history, and searching with
            vectors.
          </p>
          <p>
            Part 1 focused on the embeddable widget; <strong>here we own persistence and
            search</strong>: Neon PostgreSQL with <strong>pgvector</strong>, Drizzle ORM,
            and MCP tools wired to your database. The goal is a clear path from tutorial
            prompts to a deployable MCP server (for example on Vercel) that the Part 1
            client can use without changing its contract.
          </p>
        </div>

        <ul className={styles.points}>
          <li>
            <span className={styles.pointTitle}>MCP over HTTP</span>
            Streamable HTTP at <code className={styles.code}>/mcp</code> — session via{" "}
            <code className={styles.code}>mcp-session-id</code>, JSON-RPC for tools.
          </li>
          <li>
            <span className={styles.pointTitle}>Data layer</span>
            Neon + Drizzle migrations; embeddings and chat rows land in Postgres as you
            follow the ChatVault prompts (from Prompt6 onward).
          </li>
          <li>
            <span className={styles.pointTitle}>Tutorial flow</span>
            Generic steps live in <code className={styles.code}>
              prompts/part2/cursor/common.md
            </code>
            ; ChatVault-specific tools are in{" "}
            <code className={styles.code}>chatVaultPrompts.md</code>.
          </li>
        </ul>

        <div className={styles.ctas}>
          <a className={styles.primary} href="/mcp?health=1">
            Check MCP endpoint (smoke)
          </a>
          <a
            className={styles.secondary}
            href="https://github.com/modelcontextprotocol/modelcontextprotocol"
            target="_blank"
            rel="noopener noreferrer"
          >
            MCP spec
          </a>
        </div>
      </main>
    </div>
  );
}
