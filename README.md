# renovate-report-html

Turn a [Renovate](https://docs.renovatebot.com/) JSON report into one interactive HTML page. Think coverage report, but for dependency updates across all your repositories.

**[See the demo](https://jvacek.github.io/renovate-report-html/demo/)**

- Pending updates by type, skipped dependencies and Renovate's problems, at a glance
- Every repository, down to each package file and dependency
- Every package across repositories: who is on which version, with outliers marked
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

This writes `public/index.html`. Requires Node 22 or later.

Supported and tested, including a weekly check against the latest Renovate release: **GitHub**, **GitLab** and **local** checkouts. Setup guides with ready-to-use CI pipelines: [GitHub](docs/github.md), [GitLab](docs/gitlab.md), [local](docs/local.md). Reports from other Renovate platforms may work but aren't tested.

> [!WARNING]
> Renovate's report format is experimental and can change between minor releases. If a Renovate version breaks the page, the CLI names the field that changed; please [open an issue](https://github.com/jvacek/renovate-report-html/issues) with that output.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Datasource logos are from [Simple Icons](https://simpleicons.org) (CC0).
