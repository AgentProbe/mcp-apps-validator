# CLAUDE.md - mcp-apps-validator Runbook

Operational instructions for Claude to work with this repository.

---

## Purpose

Validates MCP servers for the **MCP Apps / UI-extension capability (SEP-1865)**: connects via
StreamableHTTP (SSE fallback), discovers `ui://` resources, validates their HTML, CSP,
permissions, display modes, theming and graceful degradation, checks tool-UI linkage
(`_meta.ui.resourceUri` / `visibility`), measures latency, and returns a structured snapshot
(12 boolean categories, 18 entry fields) plus a `compare()` diff.

It is **Layer 5 (UI)** of the AgentProbe assessment pipeline (`mcp-server-assessment`), consumed
there via a `github:agentprobe/mcp-apps-validator` pinned dependency.

---

## Stack

| Aspect | Value |
|--------|-------|
| Runtime | Node.js 22, ES modules (`.mjs`) |
| Package | `mcp-apps-validator` v0.2.0, `type: module`, `main: ./src/index.mjs` |
| Test | Jest 30 (`NODE_OPTIONS='--experimental-vm-modules'`) |
| Deps | `@modelcontextprotocol/sdk ^1.12.1` |
| Remote | `github.com/agentprobe/mcp-apps-validator` |

---

## Entry Points

`src/index.mjs` → `McpAppsValidator` (+ `Validation`).

| Method | Signature | Returns |
|--------|-----------|---------|
| `start` | `{ endpoint, timeout = 10000 }` | `{ status, findings, categories, entries }` |
| `compare` | `{ before, after }` | `{ status, messages, hasChanges, diff }` |

This is the same unified shape every AgentProbe leaf validator exposes to the assessment engine
(see `mcp-server-assessment/NOTES-validator-interface.md`).

Tasks: `McpAppsConnector`, `UiResourceValidator`, `CapabilityClassifier`, `SnapshotBuilder`,
`Validation`.

---

## Install and Test

This repo has **no local `node_modules`** by default — install before running tests.

```bash
cd repos/mcp-apps-validator
npm i          # required once (no node_modules shipped)
npm test       # Jest, all suites
```

### Scripts

| Script | Purpose |
|--------|---------|
| `npm test` | Run all Jest suites |
| `npm run test:coverage:src` | Run with coverage over `src/**/*.mjs` |
| `npm run test:file` | Run a single test file (append the path) |

Test tree: `tests/public-methods/{start,compare}`, `tests/task/*`, `tests/helpers/config.mjs`,
`tests/manual/reference-implementation-start.mjs`.

---

## Validate a Live Server (manual)

```javascript
import { McpAppsValidator } from 'mcp-apps-validator'

const { status, messages, categories, entries } = await McpAppsValidator.start( {
    endpoint: 'https://your-mcp-server.example.com/mcp',
    timeout: 15000
} )
```

`start()` never throws on network/protocol failure — it returns an empty snapshot with all-false
categories and reports the reason in `findings` as `{ code, severity, location, message }` objects
(codes `CON-5xx`, `UIR-*`, `UIV-*`).

---

## Structure

```
mcp-apps-validator/
├── src/
│   ├── index.mjs              # exports McpAppsValidator, Validation
│   ├── McpAppsValidator.mjs   # main class (start, compare)
│   └── task/                  # McpAppsConnector, UiResourceValidator, CapabilityClassifier,
│                              #   SnapshotBuilder, Validation
├── tests/                     # public-methods/, task/, helpers/, manual/
├── jest.config.mjs
├── package.json
└── CLAUDE.md                  # this file
```

---

## Notes

- **House style:** 4-space indent, no semicolons, static methods with object params / object
  returns. Match the sibling validators (`x402-mcp-validator`, `a2a-agent-validator`).
- **`uiLinkedTools` duplication:** computed in both `McpAppsConnector.discoverUiResources` and
  `UiResourceValidator.validate` — two sources of truth for the same derived data (known,
  non-critical; consolidate if that area is touched).
- **Commit ≠ push:** run the security check before any commit; pushing is a separate user decision.
