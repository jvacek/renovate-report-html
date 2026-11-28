# Contributing

## Setup

Node 24 (`.nvmrc`) and pnpm (pinned in `package.json`).

```sh
pnpm install
prek install    # git hooks
```

`pnpm dev` starts the viewer with hot reload on `fixtures/github-report.json`. Add `?fixture=<name>` to load another file from `fixtures/`. The other scripts are in `package.json`.

Before opening a pull request, run `prek run --all-files` and `pnpm test`.

## Changelog

If people using the report would notice your change, add a line under `## Unreleased` in [CHANGELOG.md](CHANGELOG.md), in the same pull request. Put it under Added, Changed, Fixed or Removed, and describe what changed for them, not how you built it. Internal changes such as refactors, tests and CI don't need an entry. Release notes come from this file.

## How it works

The viewer (Preact, in `src/viewer/`) is built once into a single HTML template. The CLI (`src/cli.ts`) validates a report with the zod schema in `src/report/schema.ts`, trims it to what the viewer needs, and pastes it into that template. People using the CLI never run a bundler.

Renovate's report format is experimental, so the schema covers only the fields we use and fails loudly when one of them changes. A weekly CI job renders a report from the latest Renovate release to catch changes early.

## Fixtures

Only commit reports generated from public repositories. Put private ones in `fixtures/private/` (gitignored) and open them with `?fixture=private/<name>`.

There is one fixture per supported platform (GitHub, GitLab, local); tests run against all of them. To regenerate one, see the header of `scripts/generate-report.sh` for the tokens each platform needs:

```sh
RENOVATE_TOKEN=$(gh auth token) scripts/generate-report.sh fixtures/github-report.json github lookup 44.263.5
```

## Releasing

See [RELEASING.md](RELEASING.md).
