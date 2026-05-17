# Modernization Navigator MCP Server

After publishing the package, install the MCP service once and then reuse it across any repo:

```bash
npm install -g @modernization-navigator/mcp-server
modernization-navigator-mcp setup --repo /path/to/your-repo
```

That setup command writes `.bob/mcp.json`, `.bob/custom_modes.yaml`, and `.bob/rules-modernization-architect/` in the target repo and points Bob at the globally installed `modernization-navigator-mcp` binary. The target repo does not need to be a Node workspace for that bootstrap step to work.

## Commands

```bash
modernization-navigator-mcp
modernization-navigator-mcp setup --repo .
modernization-navigator-mcp print-config
modernization-navigator-mcp-setup --repo .
```

- `modernization-navigator-mcp` starts the stdio MCP server.
- `setup` writes `.bob/mcp.json` for a repo and preserves any other configured MCP servers in that file.
- `print-config` prints the reusable Bob config payload without writing to disk.
- `modernization-navigator-mcp-setup` is a convenience alias for the setup flow.

## Release Notes

Publish the workspace packages in dependency order:

1. `@modernization-navigator/shared`
2. `@modernization-navigator/knowledge-base`
3. `@modernization-navigator/providers`
4. `@modernization-navigator/analysis-engine`
5. `@modernization-navigator/viewer-server`
6. `@modernization-navigator/mcp-server`
