#!/usr/bin/env sh
# Generate a Renovate report from public projects, for fixtures and the weekly compatibility check.
#
# Usage: scripts/generate-report.sh <output.json> <github|gitlab|local> [lookup|full] [renovate-version]
#   github: public GitHub repositories. RENOVATE_TOKEN: any GitHub token, e.g. $(gh auth token).
#   gitlab: public gitlab.com projects in one group with several levels of subgroups. RENOVATE_TOKEN: a GitLab token
#           with read_api, e.g. $(glab config get token --host gitlab.com) when logged in with glab.
#           Set GITHUB_COM_TOKEN too, for lookups on github.com.
#   local:  a shallow clone of a public repository, scanned with --platform=local. Always lookup.
#           GITHUB_COM_TOKEN is optional but avoids rate limits.
#   lookup (default) gives dependency and update data; full adds branches. Both are dry runs.
set -eu

usage="usage: scripts/generate-report.sh <output.json> <github|gitlab|local> [lookup|full] [renovate-version]"
out=${1:?$usage}
platform=${2:?$usage}
mode=${3:-lookup}
version=${4:-latest}

# Absolute, because the local platform runs from another directory.
out="$(cd "$(dirname "$out")" && pwd)/$(basename "$out")"

renovate() {
  npx --yes "renovate@$version" --onboarding=false --require-config=ignored \
    --report-type=file --report-path="$out" "$@"
}

# Error stack traces in the report contain local paths; keep the home directory out of fixtures.
scrub_home() {
  [ -f "$out" ] || return 0
  sed "s|$HOME/|~/|g" "$out" > "$out.tmp" && mv "$out.tmp" "$out"
}
trap scrub_home EXIT

case "$platform" in
  github)
    renovate --platform=github --dry-run="$mode" \
      oapi-codegen/oapi-codegen \
      pallets/flask \
      expressjs/express \
      renovatebot/github-action \
      docker-library/hello-world
    ;;
  gitlab)
    renovate --platform=gitlab --endpoint=https://gitlab.com/api/v4 --dry-run="$mode" \
      gitlab-org/cli \
      gitlab-org/frontend/eslint-plugin \
      gitlab-org/frontend/untamper-my-lockfile \
      gitlab-org/cloud-native/gitlab-logger \
      gitlab-org/ci-cd/runner-tools/base-images \
      gitlab-org/ci-cd/runner-tools/releaser
    ;;
  local)
    dir=$(mktemp -d)
    trap 'rm -rf "$dir"; scrub_home' EXIT
    git clone --quiet --depth 1 https://github.com/pallets/click "$dir"
    (cd "$dir" && renovate --platform=local)
    ;;
  *)
    echo "$usage" >&2
    exit 2
    ;;
esac
