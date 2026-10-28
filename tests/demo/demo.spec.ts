import { test, expect } from "@playwright/test";

test("independent browser workspace persists edits, completes tasks, and resets without API calls", async ({
  page,
  browser,
}) => {
  const apiCalls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiCalls.push(request.url());
  });
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "A clear view of every grant." }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("link", { name: "My tasks", exact: true })
    .click();
  const task = page
    .locator(".work-table tbody tr")
    .filter({ hasText: "Review demo progress report" });
  await expect(task).toBeVisible();
  await task.getByRole("button").click();
  await expect(task).toHaveCount(0);
  await page
    .locator("nav")
    .getByRole("link", { name: "Upcoming deadlines", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Next 7 days/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".work-table tbody tr").first()).toBeVisible();
  await page.goto("/demo/grants/new");
  await page
    .getByLabel("Grant name *", { exact: true })
    .fill("Independent tester grant");
  await page.getByRole("button", { name: "Create grant", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Independent tester grant",
      exact: true,
    }),
  ).toBeVisible();
  const detailURL = page.url();
  await page.getByRole("button", { name: "Comments (0)", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Comment", exact: true })
    .fill("Browser-only handoff note.");
  await page
    .getByLabel("Optional attachment")
    .setInputFiles({
      name: "evidence.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Evidence\nFictional demo evidence"),
    });
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(
    page.getByRole("button", { name: "Comments (1)" }),
  ).toBeVisible();
  await expect(page.locator(".comment p")).toHaveText(
    "Browser-only handoff note.",
  );
  const download = page.waitForEvent("download");
  await page
    .locator(".comment")
    .getByRole("link", { name: "evidence.csv" })
    .click();
  expect((await download).suggestedFilename()).toBe("evidence.csv");
  await page
    .getByRole("button", { name: "Current stage", exact: true })
    .click();
  await page.getByRole("button", { name: "Complete & advance" }).click();
  await page.getByRole("button", { name: "Confirm completion" }).click();
  await expect(page.locator(".stage-heading h2")).toHaveText(
    "Application Received",
  );
  await page.reload();
  await expect(page.locator(".stage-heading h2")).toHaveText(
    "Application Received",
  );
  await page.getByRole("button", { name: "Comments (1)" }).click();
  await expect(
    page.getByRole("button", { name: "Documents (1)" }),
  ).toBeVisible();

  const second = await browser.newContext();
  const independent = await second.newPage();
  await independent.goto("http://127.0.0.1:3014/demo/tasks");
  await expect(
    independent.getByText("Review demo progress report", { exact: true }),
  ).toBeVisible();
  await independent.goto("http://127.0.0.1:3014/demo");
  await independent
    .getByRole("textbox", { name: "Search grants" })
    .fill("Independent tester grant");
  await expect(
    independent.getByRole("link", {
      name: "Independent tester grant",
      exact: true,
    }),
  ).toHaveCount(0);
  await second.close();

  const duplicate = await page.context().newPage();
  await duplicate.goto("/demo");
  await expect(
    duplicate.getByText(/This demo is open in another tab/),
  ).toBeVisible();
  await duplicate.close();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Reset my demo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A clear view of every grant." }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search grants" })
    .fill("Independent tester grant");
  await expect(
    page.getByRole("link", { name: "Independent tester grant", exact: true }),
  ).toHaveCount(0);
  await page.goto(detailURL);
  await expect(
    page.getByText("Grant not found", { exact: true }),
  ).toBeVisible();
  expect(apiCalls).toEqual([]);
});

test("CSV preview, confirmation, export, and public entry need no hosted services", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: /Try the demo/ }).click();
  await expect(
    page.getByRole("heading", { name: "A clear view of every grant." }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("link", { name: "Import grants", exact: true })
    .click();
  await page
    .getByLabel("Import file", { exact: true })
    .setInputFiles({
      name: "demo.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Grant name,Grant ID,Funding program\nImported demo grant,DEMO-CSV-TEST,HHAP",
      ),
    });
  await expect(
    page.getByLabel("Grant name row 1", { exact: true }),
  ).toHaveValue("Imported demo grant");
  await page.getByRole("button", { name: "Confirm 1 records" }).click();
  await expect(
    page.getByText("1 imported · 0 updated · 0 skipped · 0 errors"),
  ).toBeVisible();
  await page.getByRole("link", { name: "View grants", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search grants" })
    .fill("Imported demo grant");
  await expect(
    page.getByRole("link", { name: "Imported demo grant", exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.locator('a[href="/api/export"]').click();
  expect((await download).suggestedFilename()).toBe("demo-grants.csv");
  await page.goto("/demo/templates");
  await expect(
    page.getByRole("heading", { name: "Workflow templates", exact: true }),
  ).toBeVisible();
  await page.goto("/demo/cycles");
  await expect(
    page.getByRole("heading", { name: "Funding cycles", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "Grants tracker" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await page.request.get("/api/data")).status()).toBe(401);
});
