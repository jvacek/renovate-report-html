import type { ReportData } from "../../report/data.ts";
import { ProblemList, RepoName } from "../components.tsx";
import { href } from "../router.ts";

export function ProblemsView({ data }: { data: ReportData }) {
  const repos = data.repositories.filter((r) => r.problems.length > 0);
  return (
    <>
      <h1>Problems</h1>
      <p class="muted">
        Warnings and errors Renovate reported while processing. Global problems are not tied to a repository.
      </p>
      {data.problems.length === 0 && repos.length === 0 && <p>Renovate reported no problems.</p>}
      {data.problems.length > 0 && (
        <section>
          <h2>Global</h2>
          <ProblemList problems={data.problems} />
        </section>
      )}
      {repos.map((repo) => (
        <section key={repo.name}>
          <h2>
            <a href={href.repo(repo.name)}>
              <RepoName name={repo.name} />
            </a>
          </h2>
          <ProblemList problems={repo.problems} />
        </section>
      ))}
    </>
  );
}
