# RealtorPro Graphify map

This is the Mac-first release snapshot, before the Investors section was added.
See [Investors](../INVESTORS.md) for the new profile/import behavior; regenerate
the graph below to include its new files and relationships.

Refreshed 2026-09-07 with the Mac-first release changes: Keychain, native folder
chooser, desktop launcher and connection regression tests.

- Open `graph.html` in a browser for the interactive graph and community filters.
- Open `GRAPH_TREE.html` for the folder hierarchy.
- Read `GRAPH_REPORT.md` for generated analysis.
- Use `graph.json` with Graphify query/path/explain commands.

715 nodes, 2,128 connections, 35 named groups; 119 code/configuration files
scanned locally with no external model API calls. The network view was browser
checked, including search. Libraries load from public CDNs, so first viewing
requires internet access.

Private workspace data, environment credentials, dependencies and build output
were excluded. Four documents were omitted by code-only mode; CSS and the
two .command launchers are unsupported by this extractor
and three Drizzle metadata JSON files produced no nodes. The TypeScript schema
and SQL migrations are represented. Versioned test fixtures and opt-in demo seed
code are included as source, not as active CRM records.

16 edges are INFERRED (average confidence 0.73). Some surprising connections
appear to be false matches on common names such as `text()` and `d()`: do not
treat them as verified runtime call paths. The exported graph's integrity check
found no dangling/missing endpoints, self-loops or duplicate endpoint pairs.
251 isolated nodes include configuration entries and other disconnected symbols.
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
