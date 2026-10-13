# Project: xron-workspace
## Tech Stack: Node/JS

## Agent Rules
- **Maintain Documentation**: Preserve existing comments and docstrings.
- **Testing**: Always verify changes by running tests if available.
- **Boundaries**: Avoid modifying configuration files unless explicitly requested.
- **Test Command**: npm test
## Project Context
This repository is part of the marketing operations and ad-tech automation stack managed by Gordon Geraghty.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **XRON** (7371 symbols, 23403 relationships, 656 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact before editing.** Use `impact({target: "symbolName", direction: "upstream"})` or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .`; report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "master"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "master" --repo .`.
- MUST warn on HIGH/CRITICAL `risk` pre-edit; never use `riskSharedAxes` to waive a HIGH/CRITICAL `risk` warning. Compare File/symbol: MCP File omits axes; Graph-RAG expands File.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- **MUST use `query({search_query: "concept"})` for concepts/flows, `context({name: "symbolName"})` for a named symbol, or `impact` for blast radius, on read-only callers, dependencies, imports, or execution flow.** Graph first; text search only for empty/`UNKNOWN`/literals.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/XRON/context` | Codebase overview, check index freshness |
| `gitnexus://repo/XRON/clusters` | All functional areas |
| `gitnexus://repo/XRON/processes` | All execution flows |
| `gitnexus://repo/XRON/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

---

## Part 2 — Code intelligence rules

## Code intelligence rules (GitNexus + Graphify)

This repository is indexed by two tools. Each has its own job.

| Tool | Job | Use it for |
| --- | --- | --- |
| **GitNexus** (`.gitnexus/`, MCP + `node .gitnexus/run.cjs`) | Safety. It gives exact callers, execution flows and risk levels. | Impact checks before you edit, change checks before you commit, renames. |
| **Graphify** (`graphify-out/`, `graphify` command) | Orientation. It gives a map of the architecture. | Learning an unfamiliar area, finding the main hubs, searching for a concept. |

GitNexus results decide whether a change is safe. Graphify never replaces a GitNexus check.

### Start of every task

1. Run `node .gitnexus/run.cjs status`. If it says **stale**, run `node .gitnexus/run.cjs analyze --index-only`. The `--index-only` flag refreshes the index without rewriting `AGENTS.md`, `CLAUDE.md` or the skill files.
2. Compare the "Built from commit" line in `graphify-out/GRAPH_REPORT.md` with `git rev-parse HEAD`. If they differ, run `graphify update .`.
3. Re-index both tools after you **add** new files or functions. A symbol created after the last index returns "not found", "no unique node match" or `UNKNOWN`.
4. In an unfamiliar area, read `graphify-out/GRAPH_REPORT.md` first. Then run `graphify query "<concept>" --budget 2000`, or the GitNexus `query` tool, to find the files involved.

### Always do

1. **Impact check before editing.** Before you change a function, class or method, run `impact` on it.
   - MCP: `impact({target: "name", direction: "upstream"})`
   - Command line: `node .gitnexus/run.cjs impact "name" --direction upstream --repo .`
   - Report the callers, the affected flows and the risk level.
   - If several symbols share the name, add `--file <path>`.
2. **Change check before committing.** Run `detect_changes`.
   - MCP: `detect_changes({scope: "all"})`
   - Command line: `node .gitnexus/run.cjs detect-changes --scope all --repo .`
   - List the affected flows in your summary.
   - To review against the default branch, use `--scope compare --base-ref master`.
3. **Warn on HIGH or CRITICAL risk.** Tell the user before you edit or commit, and name the affected flows so they can judge the risk. A high score can come from many flows inside one new feature, so show the flows. Do not explain the warning away.
4. **`UNKNOWN` means "not answered", not "safe".** An empty caller list can mean the index cannot see the callers. Causes include dynamic calls, property access on plain objects, calls across languages, and a stale index. Re-index, then confirm with a text search and `graphify affected "<name>"` before you treat the symbol as unused or safe to delete.
5. **Use the graphs first, text search second.**
   - Use GitNexus `context` for one named symbol, `impact` for blast radius, and `trace` for "how does A reach B".
   - Use `graphify explain "<name>"` for a quick neighbourhood view, and `graphify path "A" "B"` for the shortest link.
   - Use text search only when the graphs return nothing or `UNKNOWN`, or to find literal strings.
6. **A partial result is not a clean result.**
   - If GitNexus says `partial: true` or `truncated: true`, a zero means "not seen", not "not affected". Narrow the scope and run it again.
   - If Graphify prints `TRUNCATED`, raise `--budget` or narrow the query.
7. **Before you change a hub, check what depends on it.** Run `graphify god-nodes`. Treat the top entries (for example, an auth helper used by every page) as high-risk, even if the impact score is low.
8. **Security reviews.** `explain({target: "fileOrSymbol"})` lists taint findings, which are places where untrusted input reaches a dangerous call. It needs an index built with `analyze --pdg` and works through MCP only. No finding is not proof of safety.

### Never do

1. Never edit a function, class or method before the impact check.
2. Never ignore a HIGH or CRITICAL risk, and never read `UNKNOWN` as an all-clear.
3. Never rename a symbol with find-and-replace. Use the MCP `rename` tool, which edits every caller. If MCP is not available, run `impact` first, update every caller it lists, then run `detect_changes` and a text search for the old name.
4. Never commit before the change check.
5. Never commit `.gitnexus/` or `graphify-out/`.

### Reference

| Need | Where |
| --- | --- |
| Codebase overview, index freshness | `gitnexus://repo/XRON/context` |
| All functional areas | `gitnexus://repo/XRON/clusters` |
| All execution flows | `gitnexus://repo/XRON/processes` |
| One flow, step by step | `gitnexus://repo/XRON/process/{name}` |
| Architecture summary and hubs | `graphify-out/GRAPH_REPORT.md` |
| Visual map | `graphify-out/graph.html` (open in a browser) |
| How the code works | `.claude/skills/gitnexus-exploring/SKILL.md` |
| What breaks if I change X | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Why is X failing | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename, extract, split, move | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Full GitNexus tool list | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki commands | `.claude/skills/gitnexus-cli/SKILL.md` |

---

## Part 3 — Working rules learned on Empire-Amplify-Hub

### How to work

1. **Plan before you build a feature.** Explore the code, then write a short plan that names the files to change and the existing helpers to reuse. Get the user's approval before you write code. Ask about real business choices, for example "calendar month or each account's own billing cycle?". Do not guess them.
2. **Reuse before you write.** Search for an existing helper first: date functions, formatters, query patterns, UI components. Copy the conventions of the nearest similar page.
3. **Leave working code alone.** When a new feature needs different behaviour from a shared function, add a new function. Do not change the shared one unless the user asks.
4. **Verify in layers, and report what you could not verify:**
   - Run the type check and the production build.
   - Test pure logic (dates, sums, percentages) with fixed inputs and stubbed data. Include the edge cases: first day of a period, last day, missing data, zero values.
   - Check UI behaviour in a real browser (Playwright) and measure it. For example, check sort order and element positions after scrolling.
   - If you cannot reach the live database or sign in, say so. Never present a check against sample data as a check against live data.
5. **Mock-ups use invented data and must say so.** Label sample figures and stand-in parts of the screen (such as the sidebar) clearly.
6. **Keep generated files out of commits.** Do not commit index folders, lockfile changes caused only by a local install, or agent files generated by tools (`AGENTS.md`, `CLAUDE.md`, skills) without asking. Stage files by name, never with `git add -A`.
7. **Commits and pull requests.**
   - Work on the assigned branch.
   - Write commit messages that say what changed and why.
   - Open a pull request only when asked.
   - Never rewrite history on a shared branch. Add follow-up commits instead.
8. **Explain plainly.** Team members are not all technical. Use short sentences and common words, and explain each technical term the first time you use it.

### Data and dates (apply when the repository handles advertising or reporting data)

1. **Spend ranges end yesterday.** Google Ads (and most ad platforms) keep changing today's figures for hours afterwards. "Month to date" on the 9th means the 1st to the 8th. Averages ("7-day", "14-day") cover the days ending yesterday. A day with no data counts as zero.
2. **Use the agency's time zone (Australia/Sydney), not UTC.** Servers run in UTC. Converting a date with `toISOString().slice(0, 10)` gives the wrong day for about ten hours of every day in Australia. Use the repository's time zone helper. Check every "today", "yesterday" and month-start calculation.
3. **Budget periods are not always calendar months.** Some clients bill from another day (for example the 15th to the 14th). Pace each account against its own cycle.
4. **Zero is not a budget.** A saved target of 0 is usually a placeholder. Skip it and use the most recent real target, which stays in force until it is replaced.
5. **No budget means "unknown", not "0%".** Show a dash and a clear status such as "No budget set". When you sort, keep rows with no value at the bottom in both directions.
6. **Don't add up different currencies.** Total only one currency (for example AUD), and label the total.
7. **Pages that list every account must batch their queries.** Use one query for all accounts, not one or two queries per account in a loop.

### Interface patterns

1. Sortable tables:
   - Default to sorting by name, A to Z, ignoring case.
   - Clicking a heading sorts by that column; a second click reverses it.
   - Show the direction with an arrow and set `aria-sort`.
2. Sticky table headings:
   - Put the table in its own scroll frame (a maximum height with `overflow: auto`) and give the heading cells `position: sticky; top: 0` with a background colour.
   - Use an inset shadow instead of a border, because borders do not move with sticky cells.
   - A totals row can stick to the bottom in the same way.
3. A new route next to a dynamic route (for example `/google-ads/pacing` beside `/google-ads/[accountId]`) takes priority over it. Add it to any list of fixed sections and check that no existing record uses that slug.
