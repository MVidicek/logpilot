# Contributing to LogPilot

Thanks for your interest in contributing. Here's how to get started.

## Development Setup

1. **Prerequisites**: Node.js 18+, Docker (for ClickHouse, Postgres, Redis)

2. **Clone and install**:
   ```bash
   git clone https://github.com/MVidicek/logpilot.git
   cd logpilot
   npm install
   ```

3. **Start infrastructure**:
   ```bash
   cd deploy
   docker compose up clickhouse postgres redis -d
   ```

4. **Run the server**:
   ```bash
   npm run dev --workspace=packages/server
   ```

5. **Run the frontend**:
   ```bash
   npm run dev --workspace=packages/web
   ```

## Project Structure

- `packages/server/` — Fastify backend (TypeScript)
- `packages/web/` — Vue 3 frontend (TypeScript + Vite)
- `packages/sdk/node/` — Node.js SDK
- `packages/sdk/python/` — Python SDK
- `deploy/` — Docker Compose and Dockerfiles

## Running Tests

```bash
npm run test
```

## Code Style

- TypeScript strict mode
- Vue 3 Composition API with `<script setup>`
- Use meaningful commit messages (`feat:`, `fix:`, `chore:`, `docs:`)

## Pull Requests

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Add tests if applicable
4. Make sure tests pass
5. Open a PR with a clear description

## Reporting Issues

Open an issue on GitHub. Include:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Node version, browser)
