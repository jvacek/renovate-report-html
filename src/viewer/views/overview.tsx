import type { ReportData } from "../../report/data.ts";
import type { Summary } from "../../report/stats.ts";
import { BarList, plural, Stat, UPDATE_TYPE_ORDER, UpdateBadge } from "../components.tsx";
import { href } from "../router.ts";

export function Overview({ data, summary }: { data: ReportData; summary: Summary }) {
  const pending = Object.values(summary.updatesByType).reduce((a, b) => a + b, 0);
  const reposWithProblems = data.repositories.filter((r) => r.problems.length > 0);
  const skipped = Object.values(summary.skippedByReason).reduce((a, b) => a + b, 0);

  return (
    <>
      <h1>Overview</h1>
      <div class="stats">
        <Stat label="Repositories" value={<a href={href.repos()}>{summary.repositories}</a>} />
        <Stat label="Dependencies" value={summary.deps} />
        <Stat label="Dependencies with updates" value={summary.depsWithUpdates} />
        <Stat label="Pending updates" value={pending} />
        <Stat label="Skipped" value={skipped} />
        <Stat
          label="Problems"
          value={<a href={href.problems()}>{summary.problems}</a>}
          tone={summary.problems ? "warn" : undefined}
        />
      </div>

      {summary.problems > 0 && (
        <section class="callout callout-warn">
          <h2>Problems</h2>
          <p>
            {data.problems.length > 0 && <>{plural(data.problems.length, "global problem")}. </>}
            {reposWithProblems.length > 0 && (
              <>
                {plural(reposWithProblems.length, "repository", "repositories")} with problems:{" "}
                {reposWithProblems.map((repo, i) => (
                  <span key={repo.name}>
                    {i > 0 && ", "}
                    <a href={href.repo(repo.name)}>{repo.name}</a> ({repo.problems.length})
                  </span>
                ))}
                .
              </>
            )}
          </p>
          <a class="button" href={href.problems()}>
            See all problems
          </a>
        </section>
      )}

      <div class="columns">
        <section>
          <h2>Pending updates by type</h2>
          <BarList
            counts={summary.updatesByType}
            order={UPDATE_TYPE_ORDER}
            classFor={(type) => `type-${type}`}
            label={(type) => <UpdateBadge type={type} />}
          />
        </section>
        <section>
          <h2>Skipped dependencies</h2>
          <BarList counts={summary.skippedByReason} />
        </section>
      </div>

      <p class="actions">
        <a class="button" href={href.repos()}>
          View all {plural(summary.repositories, "repository", "repositories")}
        </a>
        <a class="button" href={href.packages()}>
          Browse packages
        </a>
      </p>
    </>
  );
}
