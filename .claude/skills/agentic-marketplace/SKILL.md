---
name: agentic-marketplace
description: Discover, evaluate, install, configure, and orchestrate agentic marketplaces, custom plugins, subagents, and MCP tool servers for Claude Code.
---

# Agentic Marketplace & Plugin Management Skill

Provides workflows to discover, install, audit, and orchestrate agent plugins, custom subagents, skills, and Model Context Protocol (MCP) servers.

## Core Capabilities

### 1. Marketplace Discovery & Registration
- Manage known marketplaces in `~/.claude/settings.json` under `extraKnownMarketplaces`.
- Supported source types:
  - **GitHub Repositories:** e.g., `affaan-m/everything-claude-code`, `DietrichGebert/ponytail`.
  - **Local Directories & Catalogs:** Custom private marketplaces defined via `marketplace.json`.

### 2. Plugin & Skill Installation Workflow
1. **Audit:** Review plugin manifest (`.claude-plugin/plugin.json`), permissions, tools, and hooks before enabling.
2. **Registration:**
   ```json
   {
     "extraKnownMarketplaces": {
       "<marketplace-name>": {
         "source": {
           "source": "github",
           "repo": "owner/repo"
         }
       }
     },
     "enabledPlugins": {
       "<plugin-name>@<marketplace-name>": true
     }
   }
   ```
3. **Verification:** Inspect available commands, skills, and agents to ensure clean integration.

### 3. Agent & Subagent Orchestration
- **Agent Registry:** Inspect available agent templates in `.claude/agents/` or installed plugin bundles.
- **Workflow Dispatching:** Fan out specialized subagents (architect, reviewer, tester) based on project needs.
- **Role Assignment:** Match agents to task complexity, ensuring clear input/output contracts.

### 4. MCP Server Management
- Maintain MCP servers in `~/.claude.json` or project-level `.claude/mcp-servers.json`.
- Enforce context budget: keep active MCP tools under ~80 to avoid context bloat.
