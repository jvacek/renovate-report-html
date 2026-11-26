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
    - npx --yes renovate-report-html renovate-report.json -o public/ --title "Renovate report" --endpoint="$CI_SERVER_URL"
  pages: true
```

`--endpoint` points the repository and merge request links at your GitLab instance. Without it they go to gitlab.com.

`pages: true` needs GitLab 17.10 or later. On older versions, keep the job name `pages` and add `artifacts: { paths: [public/] }`.

Then create a schedule under **Build → Pipeline schedules**. To keep the report private, drop `pages: true` and add `artifacts: { paths: [public/] }` instead, or restrict Pages access in the project settings.

## Project icons

By default the page loads project and group icons straight from GitLab. Group icons show in the **Folders** view of the repository list. Loading them from GitLab only works for public projects and groups: browsers don't send your GitLab login along with images on another site, and GitLab Pages counts as another site.

For private projects, download the icons in the pipeline and pass the folder with `--icons`. The page then carries them itself. The Renovate image can't install ImageMagick, so split the job in two: Renovate writes the report, and a Node job fetches the icons, shrinks them to 64 px, and renders the page.

```yaml
renovate:
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
  artifacts:
    paths: [renovate-report.json]

pages:
  image: node:24-alpine
  needs: [renovate]
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
  script:
    - apk add --no-cache curl imagemagick imagemagick-jpeg imagemagick-webp
    - |
      node -e '
        const repos = Object.keys(require("./renovate-report.json").repositories);
        const groups = new Set(repos.flatMap((r) => r.split("/").slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join("/"))));
        for (const r of repos) console.log("projects", r, encodeURIComponent(r));
        for (const g of groups) console.log("groups", g, encodeURIComponent(g));
      ' |
      while read -r kind name id; do
        curl -sfL -H "PRIVATE-TOKEN: $RENOVATE_TOKEN" -o icon "$CI_API_V4_URL/$kind/$id/avatar" || continue
        mkdir -p "icons/$(dirname "$name")"
        magick "icon[0]" -resize "64x64>" "icons/$name.webp" || echo "Could not convert the icon of $name"
      done
    - npx --yes renovate-report-html renovate-report.json -o public/ --title "Renovate report" --endpoint="$CI_SERVER_URL" --icons icons/
  pages: true
```

Alpine's `imagemagick` package reads PNG, GIF, BMP and ICO; `imagemagick-jpeg` and `imagemagick-webp` add the other formats GitLab accepts for icons. `-L` follows the redirect GitLab sends for moved or renamed projects. Projects and groups without an icon get a letter tile. `--icons` takes any folder laid out as `<project or group path>.<ext>`, such as `icons/my-group/subgroup/project-b.png` or `icons/my-group.png`, so you can also supply your own images.

## Options

- `--dry-run=full` also lists the branches Renovate would create. Nothing is pushed either way.
- `--autodiscover` instead of a project list scans everything the token can see.
- Already running [renovate-runner](https://gitlab.com/renovate-bot/renovate-runner)? Set `RENOVATE_REPORT_TYPE: file` and `RENOVATE_REPORT_PATH: renovate-report.json` on that job, keep the file as an artifact, and render it in a later job.
