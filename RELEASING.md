# Releasing

Releases go to npm from GitHub Actions (`.github/workflows/release.yml`) when a version tag is pushed. Publishing uses npm trusted publishing, so there is no npm token anywhere, and npm attaches provenance automatically.

## Releasing a new version

From an up-to-date `main` with a clean working tree:

1. In [CHANGELOG.md](CHANGELOG.md), rename `## Unreleased` to `## X.Y.Z - YYYY-MM-DD` and commit it.
2. Tag and push:

   ```sh
   npm version minor        # or patch / major: bumps package.json, commits, tags vX.Y.Z
   git push --follow-tags
   ```

3. Start a new empty `## Unreleased` section for the next changes.

The workflow tests and packs the tagged commit, waits for approval in the `npm` environment, publishes, and creates a GitHub release with that version's changelog section as its notes and the package attached. It stops before publishing if the changelog has no section for the version.

## One-time setup

npm can only connect a workflow to a package that already exists, so the first version is published by hand.

1. **GitHub environment.** Settings → Environments → New environment `npm`. Add yourself as a required reviewer, and limit deployments to tags matching `v*`.
2. **First publish**, from a clean checkout of `main`:

   ```sh
   pnpm install --frozen-lockfile   # or: npx pnpm install --frozen-lockfile
   npm login
   npm version 0.1.0
   npm publish             # prepack builds dist/ first
   git push --follow-tags  # the workflow skips the publish (already on npm) and creates the GitHub release
   ```
3. **Trusted publisher**, within 2 days of the first publish or the setting expires: npmjs.com → renovate-report-html → Settings → Trusted publisher → GitHub Actions. Owner `jvacek`, repository `renovate-report-html`, workflow `release.yml`, environment `npm`.
4. **Lock it down.** Same page, Publishing access: "Require two-factor authentication and disallow tokens". From then on only the workflow can publish.
