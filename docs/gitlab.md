# GitLab

A scheduled pipeline that runs Renovate in dry-run mode over your projects, renders the report, and publishes it on GitLab Pages.

## Tokens

Add these as masked CI/CD variables:

- `RENOVATE_TOKEN`: a group or project access token with the **Reporter** role and the `read_api` and `read_repository` scopes, covering the projects you want in the report.
- `GITHUB_COM_TOKEN`: any GitHub token (no scopes needed). Renovate uses it for lookups on github.com, such as GitHub Actions tags, and hits rate limits without it.

## Pipeline

`.gitlab-ci.yml`:

```yaml
pages:
  image: ghcr.io/renovatebot/renovate:44
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
  script:
    - >
      renovate
      --platform=gitlab
      --endpoint="$CI_API_V4_URL"
      --dry-run=lookup
      --report-type=file
      --report-path=renovate-report.json
      my-group/project-a my-group/subgroup/project-b
    - npx --yes renovate-report-html renovate-report.json -o public/ --title "Renovate report"
  pages: true
```

`pages: true` needs GitLab 17.10 or later. On older versions, keep the job name `pages` and add `artifacts: { paths: [public/] }`.

Then create a schedule under **Build → Pipeline schedules**. To keep the report private, drop `pages: true` and add `artifacts: { paths: [public/] }` instead, or restrict Pages access in the project settings.

## Options

- `--dry-run=full` also lists the branches Renovate would create. Nothing is pushed either way.
- `--autodiscover` instead of a project list scans everything the token can see.
- Already running [renovate-runner](https://gitlab.com/renovate-bot/renovate-runner)? Set `RENOVATE_REPORT_TYPE: file` and `RENOVATE_REPORT_PATH: renovate-report.json` on that job, keep the file as an artifact, and render it in a later job.
