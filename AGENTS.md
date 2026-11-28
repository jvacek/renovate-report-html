# AGENTS.md

Renovate `reportType=file` JSON in, one self-contained `index.html` out. Scripts are in `package.json`. How it fits together is in CONTRIBUTING.md.

## Rules

- **Report format is experimental upstream.** `src/report/schema.ts` lists only the fields we use, type-checks them strictly, and strips the rest. To use a new field, add it to the schema, then carry it through `data.ts`.
- **Logic goes in `src/report/`** as pure functions with Vitest tests. Components in `src/viewer/` only render.
- **Fixtures come from public repos only** (regenerate with `scripts/generate-report.sh`). Private reports go in the gitignored `fixtures/private/`. Fixtures are Renovate output as written by that script (it only swaps `$HOME` for `~`): never reformat them.
- **Template contract:** the CLI string-replaces `__RENOVATE_REPORT_DATA__` and `<title>` in the prebuilt `dist/viewer/index.html`. Pass replacer functions to `.replace` so `$&` in report data stays literal. Biome skips `src/viewer/index.html` because it can't parse the placeholder.
- **Gate dev-only code on `__DEV_SERVER__`,** not `import.meta.env.DEV`. `DEV` follows `NODE_ENV`, so a build under Vitest would bundle the fixtures.
- **Datasources:** add the logo mapping in `src/viewer/datasource-icons.ts` (a Vite virtual module keeps only the path and colour). Registry links go in `src/report/registry.ts`.
- **Node:** the CLI supports every LTS line from 22 on, and CI runs tests on each. `@types/node` is pinned to the oldest one on purpose.
- **Pages:** the demo renders to `out/demo/`; `site/` is the root (the future project page).
- **Distribution plan:** npm `bin`, then a `bun --compile` binary. Keep the CLI to Node built-ins plus zod, and locate the template relative to `import.meta.url`.
- **CI:** pin actions to commit SHAs and give each job only the permissions it needs.
- **User-facing copy:** plain wording, no em-dashes.
- **Changelog:** a change people using the report would notice gets a line under `## Unreleased` in `CHANGELOG.md`, in the same commit. Write what changed for them, not how. Releases take their notes from it (RELEASING.md).
- **Toolbars:** search box first, then its match count. Filters and view controls go in `.toolbar-end` in the same `.toolbar`, so they sit right-aligned next to the search and never on a row of their own. A filter with more than one value is a `FilterPicker` dropdown, not a row of chips.

## Done means

`prek run --all-files`, `pnpm test` (the smoke test builds the page itself), `pnpm build && pnpm render:fixture`. prek only checks files git knows about, so new files need to be tracked first.
