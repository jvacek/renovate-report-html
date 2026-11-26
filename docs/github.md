# GitHub

A scheduled workflow that runs Renovate in dry-run mode over your repositories, renders the report, and publishes it on GitHub Pages.

## Token

Create a fine-grained personal access token (or a GitHub App) with read access to **Contents** on the repositories you want in the report, and store it as the `RENOVATE_TOKEN` secret. Add read access to **Dependabot alerts** if you don't want a "cannot access vulnerability alerts" problem for every repository.

The workflow's own `GITHUB_TOKEN` is enough when every repository is public.

## Workflow

`.github/workflows/renovate-report.yml`:

```yaml
name: Renovate report

on:
  schedule:
    - cron: "0 6 * * 1"
  workflow_dispatch:

permissions: {}

jobs:
  report:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24

      - name: Run Renovate
        env:
          RENOVATE_TOKEN: ${{ secrets.RENOVATE_TOKEN }}
        run: >
          npx --yes renovate
          --platform=github
          --dry-run=lookup
          --report-type=file
          --report-path=renovate-report.json
          my-org/repo-a my-org/repo-b

      - run: npx --yes renovate-report-html renovate-report.json -o public/ --title "Renovate report"

      - uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0
        with:
          path: public/

  deploy:
    needs: report
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - id: deploy
        uses: actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346 # v5.0.1
```

Set **Settings → Pages → Source** to "GitHub Actions" once. To keep the report private, replace the two Pages steps with `actions/upload-artifact` and download the page from the run instead.

## Options

- `--dry-run=full` also lists the branches Renovate would create. Nothing is pushed either way.
- `--autodiscover` instead of a repository list scans everything the token can see.
- Already self-hosting Renovate? Add `--report-type=file --report-path=renovate-report.json` (or `reportType` and `reportPath` in its global config) to your existing run and render that file.
