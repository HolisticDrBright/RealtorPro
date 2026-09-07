# RealtorPro Graphify map

Generated 2026-09-07 from application commit `d1f9dbe`. Later documentation-only
commits do not change the mapped application code.

- Open `graph.html` in a browser for the interactive graph and community filters.
- Open `GRAPH_TREE.html` for the folder hierarchy.
- Read `GRAPH_REPORT.md` for generated analysis.
- Use `graph.json` with Graphify query/path/explain commands.

680 nodes, 2,041 connections, 31 named groups; 109 code/configuration files
scanned locally with no external model API calls. The network view was browser
checked, including search. Libraries load from public CDNs, so first viewing
requires internet access.

Private workspace data, environment credentials, dependencies and build output
were excluded. Two documents were omitted by code-only mode; CSS is unsupported
and three Drizzle metadata JSON files produced no nodes. The TypeScript schema
and SQL migrations are represented. Versioned test fixtures and opt-in demo seed
code are included as source, not as active CRM records.

16 edges are INFERRED (average confidence 0.73). Some surprising connections
appear to be false matches on common names such as `text()` and `d()`: do not
treat them as verified runtime call paths. The exported graph's integrity check
found no dangling/missing endpoints, self-loops or duplicate endpoint pairs.
245 isolated nodes include configuration entries and other disconnected symbols.
This is a navigation aid, not a production certification or a complete runtime
trace. Group names were authored from observed member files.

If Graphify is installed, query from the repository root:

```bash
graphify query "Obsidian Claude MCP" --graph docs/graphify/graph.json --budget 2000
graphify explain "useApi()" --graph docs/graphify/graph.json
```

To regenerate code-only output in the default ignored output folder:

```bash
graphify extract . --code-only --max-workers 4
graphify cluster-only . --no-label
graphify tree --root . --label RealtorPro
```

Review the generated labels, confidence warnings, and changes before replacing
this published snapshot. No rebuild hooks or automatic publishing are installed.
