import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesWorkView, type WorkItem } from "../lib/work-items";
const base: WorkItem = {
  id: "s",
  grantId: "g",
  grantName: "Grant",
  name: "Review",
  kind: "Stage",
  programId: "HHAP",
  ownerId: "alex",
  ownerName: "Alex",
  deadline: null,
  estimated: true,
  status: "In Progress",
  externalParty: null,
  paused: false,
  demo: false,
  intervalDays: null,
};
test("upcoming deadline windows exclude overdue dates and include their calendar boundaries", () => {
  const day = "2026-10-27";
  assert.equal(
    matchesWorkView({ ...base, deadline: "2026-10-26" }, "week", day),
    false,
  );
  assert.equal(matchesWorkView({ ...base, deadline: day }, "week", day), true);
  assert.equal(
    matchesWorkView({ ...base, deadline: "2026-11-03" }, "week", day),
    true,
  );
  assert.equal(
    matchesWorkView({ ...base, deadline: "2026-11-04" }, "week", day),
    false,
  );
  assert.equal(
    matchesWorkView({ ...base, deadline: "2026-11-04" }, "month", day),
    true,
  );
  assert.equal(
    matchesWorkView({ ...base, deadline: "2027-01-01" }, "upcoming", day),
    true,
  );
  assert.equal(
    matchesWorkView({ ...base, deadline: day }, "overdue", day),
    false,
  );
  assert.equal(
    matchesWorkView({ ...base, deadline: "2026-10-26" }, "overdue", day),
    true,
  );
});
test("unscheduled, paused, blocked and external-decision work has explicit views", () => {
  const day = "2026-10-27";
  assert.equal(matchesWorkView(base, "unscheduled", day), true);
  assert.equal(matchesWorkView(base, "week", day), false);
  const paused = { ...base, paused: true, deadline: "2026-10-20" };
  assert.equal(matchesWorkView(paused, "overdue", day), false);
  assert.equal(matchesWorkView(paused, "paused", day), true);
  assert.equal(matchesWorkView(paused, "all", day), true);
  assert.equal(
    matchesWorkView({ ...base, status: "Blocked" }, "blocked", day),
    true,
  );
  assert.equal(
    matchesWorkView({ ...base, externalParty: "HUD" }, "waiting", day),
    true,
  );
});
