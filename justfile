# List the recipes.
default:
    @just --list

# Start the viewer with hot reload. Pick a fixture with ?fixture=<name> in the URL.
dev:
    pnpm dev

# Release the version at the top of CHANGELOG.md: bump package.json, tag, and push to trigger the release workflow.
release:
    #!/usr/bin/env bash
    set -euo pipefail
    fail() { echo "error: $*" >&2; exit 1; }

    [ -z "$(git status --porcelain)" ] || fail "commit or stash your changes first"
    [ "$(git branch --show-current)" = main ] || fail "release from main"
    git fetch --quiet origin main
    [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || fail "main is not in sync with origin/main"

    semver='[0-9]+\.[0-9]+\.[0-9]+'
    bad=$(grep -E '^## ' CHANGELOG.md | grep -Ev "^## $semver - [0-9]{4}-[0-9]{2}-[0-9]{2}$" || true)
    [ -z "$bad" ] || fail "every heading in CHANGELOG.md must be '## X.Y.Z - YYYY-MM-DD'. Rename these:"$'\n'"$bad"

    version=$(grep -m1 -E '^## ' CHANGELOG.md | cut -d' ' -f2)
    current=$(node -p "require('./package.json').version")
    [ "$version" != "$current" ] || fail "$version is already released. Add a section for the new version to CHANGELOG.md"
    [ "$(printf '%s\n%s\n' "$current" "$version" | sort -V | tail -1)" = "$version" ] \
        || fail "$version in CHANGELOG.md is older than $current in package.json"
    # The same extraction the release workflow uses for the GitHub release notes.
    notes=$(awk -v v="$version" '/^## / { p = ($2 == v); next } p' CHANGELOG.md)
    grep -q '[^[:space:]]' <<< "$notes" || fail "the $version section in CHANGELOG.md is empty"

    echo "Release notes for $version:"
    echo "$notes"
    echo
    read -rp "Release $current -> $version with these notes and push the tag? [y/N] " answer
    [ "$answer" = y ] || fail "cancelled"
    npm version "$version"
    git push --follow-tags
