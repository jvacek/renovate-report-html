# renovate-report-html

[![npm](https://img.shields.io/npm/v/renovate-report-html)](https://www.npmjs.com/package/renovate-report-html)
[![License: MIT](https://img.shields.io/npm/l/renovate-report-html)](LICENSE)

Turn a [Renovate](https://docs.renovatebot.com/) JSON report into one interactive HTML page. Think coverage report, but for dependency updates across all your repositories.

See which dependencies are outdated, which repositories have drifted to different versions of the same package, and which Renovate pull requests are still open, for a whole GitHub organisation or GitLab group in one place. It runs as a CLI in any CI pipeline and needs no server.

**[See the demo](https://jvacek.github.io/renovate-report-html/demo/)**

- Pending updates by type, skipped dependencies and Renovate's problems, at a glance
- Every repository, down to each package file and dependency
- Every package across repositories: who is on which version, with outliers marked
- Open Renovate pull or merge requests per repository, and which ones update each package
- Colour-coded dependency age, sortable tables, search, and a link for every view
- One self-contained file: open it locally, attach it to a CI job, or publish it on Pages

## Usage

Have Renovate write a report:

```sh
npx renovate --platform=github --dry-run=lookup \
  --report-type=file --report-path=renovate-report.json \
  my-org/repo-a my-org/repo-b
```

Turn it into a page:

```sh
npx renovate-report-html renovate-report.json -o public/ --title "Renovate report"
```

This writes `public/index.html`. Requires Node 22 or later. For a self-hosted GitHub or GitLab, add `--endpoint <url>` (the same value you give Renovate) so repository and pull request links point to your instance. To show repository icons, pass a folder of images with `--icons <dir>`, laid out as `<repository path>.<ext>` (group icons go at `<group path>.<ext>`). The [GitLab guide](docs/gitlab.md#project-icons) has a pipeline step that downloads and shrinks project and group icons.

Supported and tested, including a weekly check against the latest Renovate release: **GitHub**, **GitLab** and **local** checkouts. Setup guides with ready-to-use CI pipelines: [GitHub](docs/github.md), [GitLab](docs/gitlab.md), [local](docs/local.md). Reports from other Renovate platforms may work but aren't tested.

> [!WARNING]
> Renovate's report format is experimental and can change between minor releases. If a Renovate version breaks the page, the CLI names the field that changed; please [open an issue](https://github.com/jvacek/renovate-report-html/issues) with that output.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Datasource logos are from [Simple Icons](https://simpleicons.org) (CC0).
