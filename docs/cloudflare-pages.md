# Cloudflare Pages

The Pages deployment serves the Habblaud browser client only.

Build command: `npm ci --no-audit --no-fund && npm run build:client`
Output directory: `dist/client`

The full Habblaud application still requires its persistent Node.js server for live sessions, terminal integration, and real agent status. Cloudflare Pages hosts the static client; it does not run `server/index.ts`.
