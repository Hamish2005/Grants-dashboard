import { test, expect } from "@playwright/test";
test("task and deadline navigation preserves scope and exposes working date filters", async ({
  page,
}) => {
  const data = await (await page.request.get("/api/data")).json();
  await page.goto("/");
  await page
    .locator("nav")
    .getByRole("link", { name: "My tasks", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "My tasks", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^All my tasks/ }),
  ).toHaveAttribute("aria-pressed", "true");
  for (const owner of await page
    .locator(".work-table tbody tr td:nth-child(3)")
    .allTextContents())
    expect(owner).toBe(data.user.name);
  await page
    .getByRole("textbox", { name: "Search tasks and deadlines" })
    .fill("no-match-regression");
  await expect(
    page.getByText("No tasks in this view", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(
    page.getByRole("button", { name: /^All my tasks/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .locator("nav")
    .getByRole("link", { name: "Upcoming deadlines", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Next 7 days/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".work-table tbody .deadline-overdue")).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: /^Overdue/ }).click();
  await expect(page.getByRole("button", { name: /^Overdue/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: /^All upcoming/ }).click();
  await expect(page.locator(".work-table tbody .deadline-overdue")).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(
    page.getByRole("button", { name: /^Next 7 days/ }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("overview, navigation, filters, and tablet layout", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A clear view of every grant." }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "All sample grants, organizations, amounts, and deadlines are fictional.",
    ),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search grants" })
    .fill("Harbor Bridge");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Search grants" }).fill("");
  await page.getByRole("button", { name: "Kanban view" }).click();
  await expect(page.locator(".kanban-card").first()).toBeVisible();
  await page.getByRole("button", { name: "Table view" }).click();
  await page.screenshot({
    path: "test-results/overview-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(
    page.getByRole("heading", { name: "Grants tracker" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/overview-tablet.png",
    fullPage: true,
  });
  for (const url of [
    "/tasks",
    "/deadlines",
    "/cycles",
    "/templates",
    "/settings",
  ]) {
    await page.goto(url);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByText("Workspace unavailable")).toHaveCount(0);
  }
});
test("quick add, comment, attachment, stage handoff, and audit", async ({
  page,
}) => {
  const name = "Browser QA " + Date.now();
  await page.goto("/grants/new");
  await page.getByLabel("Grant name *", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Create grant", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Comments (0)", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Comment", exact: true })
    .fill("Browser test handoff note.");
  await page
    .getByLabel("Optional attachment")
    .setInputFiles({
      name: "comment-evidence.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Evidence\nFictional comment evidence"),
    });
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(
    page.getByRole("button", { name: "Comments (1)" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Comments (1)" }).click();
  await expect(page.locator(".comment p")).toHaveText(
    "Browser test handoff note.",
  );
  await expect(
    page
      .locator(".comment")
      .getByRole("link", { name: "comment-evidence.csv" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Documents (1)" }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "note.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Note\nFictional supporting note"),
  });
  await page.getByRole("button", { name: "Upload attachment" }).click();
  await expect(
    page.getByRole("button", { name: "Documents (2)" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Documents (2)" }).click();
  await expect(page.getByRole("link", { name: /note.csv/ })).toBeVisible();
  await page
    .getByRole("button", { name: "Current stage", exact: true })
    .click();
  await page.getByRole("button", { name: "Complete & advance" }).click();
  await page.getByRole("button", { name: "Confirm completion" }).click();
  await expect(page.locator(".stage-heading h2")).toHaveText(
    "Application Received",
  );
  await page
    .getByRole("button", { name: "Audit history", exact: true })
    .click();
  await expect(page.getByText("Stage advanced", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Archive grant", exact: true })
    .click();
  await expect(
    page.getByText(
      "This grant is archived and hidden from the tracker. Its records, documents, and audit history are retained.",
    ),
  ).toBeVisible();
  await page.goto("/settings");
  const archived = page
    .locator(".document-row")
    .filter({ has: page.getByRole("link", { name, exact: true }) });
  await expect(archived).toBeVisible();
  await archived.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(archived).toHaveCount(0);
});
test("file preview edits and confirmed import", async ({ page }) => {
  const name = "Imported browser project " + Date.now();
  await page.goto("/import");
  await page.getByLabel("Import file", { exact: true }).setInputFiles({
    name: "browser.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      `Grant name,Grant ID,Funding program\n${name},BROWSER-${Date.now()},HHAP`,
    ),
  });
  await expect(
    page.getByRole("heading", { name: "2. Review before importing" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Grant name row 1", { exact: true }),
  ).toHaveValue(name);
  await page.getByRole("button", { name: "Confirm 1 records" }).click();
  await expect(
    page.getByText("1 imported · 0 updated · 0 skipped · 0 errors"),
  ).toBeVisible();
  await page.getByRole("link", { name: "View grants", exact: true }).click();
  await page.getByRole("textbox", { name: "Search grants" }).fill(name);
  await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
});
