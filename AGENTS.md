# Repository Guidelines

## Project Structure & Module Organization

Production TypeScript lives in `src/`. The MCP server and tool schemas are defined in `src/index.ts`; model lifecycle logic belongs in `src/model-manager.ts`; shared contracts live in `src/types.ts`. SurrealDB code is isolated under `src/persistence/`, while `src/scripts/init-db.ts` creates the database schema. Compiled JavaScript and declarations are generated in `build/` and must not be edited by hand. Root-level Markdown files document setup, persistence, usage, and project history; `example_mcp_config.json` is the configuration template.

## Build, Test, and Development Commands

- `npm ci` installs the locked dependency set and runs the package's build preparation.
- `npm run build` compiles strict TypeScript into `build/`; run this before every commit.
- `npm run watch` recompiles continuously during development.
- `npm run init-db` initializes the configured SurrealDB schema after a successful build.
- `node build/index.js` starts the stdio MCP server for local client integration.

Use Node.js 18 or newer. SurrealDB is optional unless persistence behavior is under development.

## Coding Style & Naming Conventions

Match the existing TypeScript: two-space indentation, single quotes, semicolons, and trailing commas in multiline structures. Keep strict typing intact and avoid `any` when a concrete interface is practical. Use PascalCase for classes and types, camelCase for functions and variables, kebab-case filenames, and uppercase names for environment-derived constants. MCP tool names and wire fields use `snake_case`. Because this is Node ESM, local TypeScript imports must retain the emitted `.js` suffix.

## Testing Guidelines

No automated test framework or coverage threshold is currently configured. The minimum validation is a clean `npm run build`. For tool changes, exercise the affected tool through an MCP client and record the request and response. Persistence changes must be checked with persistence both disabled and enabled against a disposable SurrealDB instance. If introducing tests, add the runner to `package.json` and name files `*.test.ts`.

## Commit & Pull Request Guidelines

History uses short, informal summaries rather than Conventional Commits. Improve on that precedent with an imperative, specific subject such as `Fix model reload metadata`. Keep each commit focused. Pull requests should explain behavior changes, list validation performed, link related issues, and call out database schema or environment-variable changes. Include a concise MCP transcript for tool-contract changes; screenshots are only needed for changes to rendered documentation.

## Security & Configuration

Never commit credentials, `.env` files, persisted model data, or prediction logs. Use `example_mcp_config.json` as a template and replace its development credentials locally.
