"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Shell } from "./shell";
import { Tracker } from "./tracker";
import { WorkQueue } from "./work-queue";
import { NewGrant } from "./new-grant";
import { GrantDetail } from "./grant-detail";
import { Templates } from "./templates";
import Link, { DemoContext } from "./workspace-navigation";
import { PageHeading, Badge } from "./common";
import { ActionButton } from "./forms";
import { Button } from "./ui/button";
import { today } from "@/lib/utils";
import type { demoSnapshot } from "@/lib/demo/engine";
type Snapshot = Awaited<ReturnType<typeof demoSnapshot>>;
export function DemoApp() {
  const pathname = usePathname();
  const router = useRouter();
  const path = pathname.replace(/^\/demo/, "") || "/";
  const [snapshot, setSnapshot] = useState<{ path: string; data: Snapshot }>();
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [resetting, setResetting] = useState(false);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    let cancelled = false;
    setError("");
    void import("@/lib/demo/engine")
      .then(async (engine) => {
        const grantId =
          path.startsWith("/grants/") && path !== "/grants/new"
            ? decodeURIComponent(path.slice(8))
            : undefined;
        const data = await engine.demoSnapshot(grantId);
        if (!cancelled) setSnapshot({ path, data });
      })
      .catch((error) => {
        if (!cancelled) setError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [path, revision]);
  async function reset() {
    if (
      !window.confirm(
        "Reset your browser demo? Your demo edits and attachments will be removed and the sample grants restored.",
      )
    )
      return;
    setResetting(true);
    setError("");
    try {
      await (await import("@/lib/demo/engine")).resetDemo();
      router.push("/demo");
      refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setResetting(false);
    }
  }
  const data = snapshot?.path === path ? snapshot.data : undefined;
  let content;
  if (error)
    content = (
      <section className="panel demo-message">
        <h1>Demo unavailable</h1>
        <p role="alert">{error}</p>
        <a href="/demo">Reload demo</a>
      </section>
    );
  else if (!data)
    content = (
      <section className="panel demo-message" role="status">
        <h1>Preparing your demo</h1>
        <p>
          Loading sample grants and your saved browser workspace. The first
          visit may take a few moments.
        </p>
      </section>
    );
  else if (path === "/" || path === "/grants")
    content = (
      <Tracker
        grants={data.grants}
        users={data.refs.users}
        userId={data.actor.id}
        mode={path === "/" ? "overview" : "all"}
      />
    );
  else if (path === "/tasks" || path === "/deadlines")
    content = (
      <WorkQueue
        key={path}
        items={data.items}
        mode={path === "/tasks" ? "tasks" : "deadlines"}
        userId={data.actor.id}
        role={data.actor.role}
        day={today()}
      />
    );
  else if (path === "/grants/new" || path === "/import")
    content = (
      <NewGrant
        key={path}
        refs={data.refs}
        userId={data.actor.id}
        grants={data.grants}
        initialTab={path === "/import" ? "bulk" : "quick"}
      />
    );
  else if (data.detail)
    content = <GrantDetail key={data.detail.grant.id} {...data.detail} />;
  else if (path === "/templates")
    content = <Templates refs={data.refs} admin />;
  else if (path === "/cycles")
    content = (
      <>
        <PageHeading
          title="Funding cycles"
          description="Coordinate the portfolio while keeping each grant’s lifecycle separate."
        />
        <div className="template-grid">
          {data.refs.cycles.map((cycle) => (
            <section className="panel template-card" key={cycle.id}>
              <Badge tone={cycle.paused ? "amber" : "green"}>
                {cycle.paused ? "On Hold" : "Active"}
              </Badge>
              <h2>{cycle.name}</h2>
              {data.grants
                .filter((g) => g.cycleId === cycle.id)
                .map((g) => (
                  <Link
                    className="document-row"
                    key={g.id}
                    href={`/grants/${g.id}`}
                  >
                    {g.name}
                  </Link>
                ))}
              <ActionButton
                body={{ action: "cycle", id: cycle.id, paused: !cycle.paused }}
              >
                {cycle.paused ? "Resume cycle" : "Put cycle on hold"}
              </ActionButton>
            </section>
          ))}
        </div>
      </>
    );
  else if (path === "/settings")
    content = (
      <>
        <PageHeading
          title="Demo settings"
          description="Your test workspace is saved in this browser only."
        />
        <section className="panel demo-message">
          <h2>Independent testing</h2>
          <p>
            You are testing as Alex Morgan, a fictional administrator. Each
            browser has a separate copy. Changes are not shared with other
            testers or the staff workspace.
          </p>
          <p>
            Use sample information only. Clearing browser storage or using
            private browsing can remove your progress. Keep the demo open in one
            tab at a time.
          </p>
          <Button onClick={reset} disabled={resetting}>
            Reset my demo
          </Button>
          <h2 style={{ marginTop: 24 }}>Archived grants</h2>
          {data.allGrants
            .filter((g) => g.archived)
            .map((g) => (
              <div className="document-row" key={g.id}>
                <span>{g.name}</span>
                <ActionButton
                  body={{ action: "archive", id: g.id, archived: false }}
                >
                  Restore
                </ActionButton>
              </div>
            ))}
          {!data.allGrants.some((g) => g.archived) && (
            <p>No archived grants.</p>
          )}
        </section>
      </>
    );
  else
    content = (
      <section className="panel demo-message">
        <h1>Page not found</h1>
        <Link href="/">Back to demo overview</Link>
      </section>
    );
  return (
    <DemoContext.Provider value={{ refresh }}>
      <Shell name="Alex Morgan" role="Demo administrator">
        <div className="demo-banner">
          <div>
            <strong>Independent demo · No sign-in needed</strong>
            <span>
              Sample data. Changes and files stay in this browser. Use fictional
              information only.
            </span>
          </div>
          <Button
            variant="outline"
            onClick={reset}
            disabled={!data || resetting}
          >
            {resetting ? "Resetting…" : "Reset my demo"}
          </Button>
        </div>
        {content}
      </Shell>
    </DemoContext.Provider>
  );
}
