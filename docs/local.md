# Local

Scan a single checkout on your machine, without a code host or a token. Useful for a quick look at one repository, or to try a Renovate config before committing it.

From the repository's directory:

```sh
npx renovate --platform=local --report-type=file --report-path=/tmp/renovate-report.json
npx renovate-report-html /tmp/renovate-report.json -o /tmp/renovate-report/
open /tmp/renovate-report/index.html
```

Limits of the local platform:

- One directory per run: the one you run it in. It shows up in the report as `local`.
- No branch data. Renovate only looks up updates here (`--dry-run=lookup`).
- Set `GITHUB_COM_TOKEN` to any GitHub token if lookups hit GitHub rate limits.
