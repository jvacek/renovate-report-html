/**
 * Renovate datasource to Simple Icons (CC0) export name. Read at build time by
 * the `virtual:datasource-icons` plugin in vite.config.ts, which emits only the
 * SVG path and colour of each icon instead of the full icon objects.
 *
 * Datasources not listed here get a generic package icon. Packagist and Maven
 * are left out on purpose: their brand paths are 5 to 12 KB each.
 */
export const DATASOURCE_ICONS: Record<string, string> = {
  npm: "siNpm",
  "node-version": "siNodedotjs",
  pypi: "siPypi",
  "python-version": "siPython",
  go: "siGo",
  "golang-version": "siGo",
  docker: "siDocker",
  "github-tags": "siGithub",
  "github-releases": "siGithub",
  "github-digest": "siGithub",
  "github-runners": "siGithub",
  "gitlab-tags": "siGitlab",
  "gitlab-releases": "siGitlab",
  "gitlab-packages": "siGitlab",
  deb: "siDebian",
  "gradle-version": "siGradle",
  crate: "siRust",
  "rust-version": "siRust",
  rubygems: "siRubygems",
  "ruby-version": "siRuby",
  nuget: "siNuget",
  "dotnet-version": "siDotnet",
  hex: "siElixir",
  dart: "siDart",
  helm: "siHelm",
  "terraform-provider": "siTerraform",
  "terraform-module": "siTerraform",
};
