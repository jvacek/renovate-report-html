# Changelog

Notable changes for people using the report. Versions follow [semantic versioning](https://semver.org).

## Unreleased

### Changed

- Filters are dropdowns, right-aligned next to the search box: Datasource on the Packages page, Skipped on a repository page.
- The "Jump to" links on a repository page sit under the Dependencies heading, above the search.
- Triangles on folder toggles, sort arrows, menus and collapsible sections line up with the middle of the text.

### Fixed

- Rows whose first update slot is empty no longer grow taller than the others.

## 1.0.0 - 2026-11-27

### Added

- Skipped dependencies per repository, with a filter by skip reason.
- A column picker on the repository table, remembered in the browser.
- Package and lock files on a repository page link to the file on GitHub or GitLab.
- Tooltips explaining age colours, update types and libyears.

### Changed

- Problem counts show as one badge next to the repository name, instead of their own column.
- The repository table no longer has the Managers and Median age columns.
- Sorting works by clicking anywhere in a header cell.
- The overview no longer has the repository and package buttons.

## 0.7.2 - 2026-11-27

### Changed

- Identical dependencies within a package file show as one row, with how often they appear.

## 0.7.1 - 2026-11-27

### Fixed

- Dependencies without a name are named after the reference found in the file.

## 0.7.0 - 2026-11-27

### Added

- A page listing open Renovate pull or merge requests across all repositories.
- Pull or merge requests that Renovate's limits held back from opening.
- The dependency tables on a repository page link to their open pull or merge requests.

## 0.6.1 - 2026-11-27

### Changed

- Tables are easier to scan.

## 0.6.0 - 2026-11-26

### Added

- Folders and Names views on the repository list.
- `--icons` also embeds group icons, and public GitLab icons are linked directly.
- Repository icons on the package page, and larger icons in tables and on the repository page.
- JSON fields on problems collapse into one line that opens a dialog with coloured JSON.

## 0.5.0 - 2026-11-26

### Added

- `--icons <dir>` embeds repository icons from a folder.

## 0.4.0 - 2026-11-26

### Added

- GitLab project icons, with the group path faded in repository names.

## 0.3.0 - 2026-11-26

### Added

- A light, dark and system theme switcher.

## 0.2.2 - 2026-11-26

### Added

- The footer shows the tool's version and links to its repository.

### Fixed

- The newest version of a package is never marked as an outlier.

## 0.2.1 - 2026-11-26

### Added

- Open Renovate pull or merge requests on the repository, repositories and package pages, worked out from Renovate's branch data.
- The package page highlights uses behind the newest version in use.

### Fixed

- Repositories without a platform get the one from the Renovate run.

## 0.2.0 - 2026-11-26

### Added

- `--endpoint <url>` for self-hosted GitHub and GitLab, so links point to your instance.
- The repository page links to the repository, its pull requests and each open pull request.

## 0.1.2 - 2026-11-26

### Changed

- Datasource filters are sorted alphabetically.

## 0.1.1 - 2026-11-26

### Changed

- Outlier versions highlight only the use count, and repositories are listed as bullets.

## 0.1.0 - 2026-11-26

First release.
