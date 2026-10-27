import { db } from "./index";
import * as s from "./schema";
import { createGrant, addComment, updateStage } from "../grants";
import { addDays, today } from "../utils";
type Stage = [string, number | null, string, string?, boolean?, boolean?];
const hh: Stage[] = [
  ["Funding Opportunity Open", 36, "Grants & Contracts"],
  ["Application Received", null, "Grants & Contracts"],
  ["Eligibility & Completeness Review", 3, "Grants Specialist"],
  [
    "Independent Application Scoring",
    5,
    "Grants & Contracts",
    "Independent Review Committee",
  ],
  ["Preliminary Funding Recommendation", 5, "Grants Lead / Committee"],
  ["Appeals", 5, "Grants & Contracts", "Authorized Appeals Committee", true],
  [
    "Final Funding Decision",
    3,
    "Grants Lead / Committee",
    undefined,
    false,
    true,
  ],
  ["Contract Development & Negotiation", 30, "Grants & Contracts / Finance"],
  ["Contract Executed", null, "Grants & Contracts / Finance"],
  ["Project Startup", 60, "Assigned Program Lead"],
  [
    "Active Implementation & Monitoring",
    null,
    "Grants Compliance / Program Lead",
  ],
  ["Closeout", 60, "Grants / Finance"],
  ["Closed", null, "Grants & Contracts"],
];
const coc: Stage[] = [
  ["Funding Opportunity / NOFO Review", null, "Grants & Contracts"],
  ["Registration & Intent to Submit", null, "Grants & Contracts"],
  ["Application Preparation", 35, "Grants Specialist"],
  ["Local Application Submitted", null, "Grants & Contracts"],
  ["Eligibility & Performance Evaluation", null, "Grants Specialist"],
  [
    "Local Rating & Ranking",
    28,
    "Grants & Contracts",
    "Local Review Committee",
  ],
  ["Preliminary Ranking", null, "Grants Lead / Committee"],
  ["Appeals", 5, "Grants & Contracts", "Authorized Appeals Committee", true],
  ["Final Priority Listing", 14, "Grants Lead / Committee"],
  ["Consolidated Application Submitted to HUD", null, "Grants & Contracts"],
  ["Awaiting HUD Decision", null, "Grants & Contracts", "HUD"],
  ["Award Decision", null, "Grants & Contracts", "HUD", false, true],
  ["Agreement / Startup", null, "Grants & Contracts / Finance"],
  ["Active Grant Monitoring", null, "Grants Compliance / Program Lead"],
  ["Renewal or Closeout", null, "Grants / Finance"],
  ["Closed", null, "Grants & Contracts"],
];
const active: Stage[] = [
  ["Award Received", null, "Grants & Contracts"],
  ["Agreement & Budget Finalization", null, "Grants & Contracts / Finance"],
  ["Startup", null, "Assigned Program Lead"],
  ["Active Monitoring", null, "Grants Compliance / Program Lead"],
  ["Renewal Review or Closeout Preparation", null, "Grants / Finance"],
  ["Closeout", 60, "Grants / Finance"],
  ["Closed", null, "Grants & Contracts"],
];
export function seed(includeDemo = true) {
  if (db.select().from(s.users).all().length) return;
  db.transaction(() => {
    db.insert(s.users)
      .values([
        {
          id: "alex",
          name: "Alex Morgan",
          email: "alex@example.invalid",
          role: "Admin",
          team: "Grants & Contracts",
        },
        {
          id: "jordan",
          name: "Jordan Lee",
          email: "jordan@example.invalid",
          role: "Manager",
          team: "Grants Compliance / Program Lead",
        },
        {
          id: "sam",
          name: "Sam Rivera",
          email: "sam@example.invalid",
          role: "Staff",
          team: "Grants Specialist",
        },
        {
          id: "casey",
          name: "Casey Chen",
          email: "casey@example.invalid",
          role: "Manager",
          team: "Grants & Contracts / Finance",
        },
      ])
      .run();
    for (const name of ["HHAP", "CoC", "YHDP", "Other"])
      db.insert(s.programs).values({ id: name, name }).run();
    for (const [key, name, stages] of [
      ["hhap", "HHAP Strategic Investment", hh],
      ["coc", "HUD CoC NOFO", coc],
      ["active", "Active Grant", active],
      [
        "custom",
        "Custom Workflow",
        [
          ["Intake", null, "Grants & Contracts"],
          ["Review", null, "Grants Specialist"],
          ["Closed", null, "Grants & Contracts"],
        ],
      ],
    ] as [string, string, Stage[]][]) {
      db.insert(s.templates)
        .values({
          id: key,
          name,
          description:
            key === "hhap"
              ? "Based on the August 2026 RFP. Editable calendar-day planning estimates, not universal requirements. Implementation is contract-dependent, up to 24 months; closeout estimate 30–90 days."
              : key === "coc"
                ? "Planning guidance from the supplied brief; linked 2026 timeline could not be verified. HUD decision timing remains unknown."
                : "Set dates and reporting obligations from the executed agreement.",
        })
        .run();
      stages.forEach(
        ([name, duration, role, externalParty, optional, decision], position) =>
          db
            .insert(s.templateStages)
            .values({
              id: `${key}-${position}`,
              templateId: key,
              position,
              name,
              description: externalParty
                ? `${externalParty} is responsible for the external decision; the assigned staff member coordinates only.`
                : "Review the applicable funding documents and record progress here.",
              role,
              duration,
              externalParty: externalParty || null,
              optional: !!optional,
              decision: !!decision,
              defaultOwnerId:
                role === "Grants Specialist"
                  ? "sam"
                  : role.includes("Finance")
                    ? "casey"
                    : role.includes("Program Lead")
                      ? "jordan"
                      : null,
            })
            .run(),
      );
    }
    if (!includeDemo) return;
    db.insert(s.cycles)
      .values([
        {
          id: "demo-hhap",
          name: "2026 Strategic Investment · Demo",
          programId: "HHAP",
        },
        {
          id: "demo-coc",
          name: "2026 CoC competition · Demo",
          programId: "CoC",
        },
        { id: "demo-yhdp", name: "Youth housing · Demo", programId: "YHDP" },
      ])
      .run();
    const actor = db.select().from(s.users).get()!;
    const demos = [
      [
        "Harbor Bridge Housing",
        "HHAP",
        "hhap",
        7,
        "casey",
        "Harbor Community Partners",
        4,
      ],
      [
        "Pathways to Home",
        "HHAP",
        "hhap",
        3,
        "alex",
        "Pathways Community Alliance",
        2,
      ],
      [
        "Youth Housing Connections",
        "YHDP",
        "active",
        3,
        "jordan",
        "Youth Futures Collaborative",
        -3,
      ],
      [
        "North County Housing Stability",
        "CoC",
        "coc",
        10,
        "alex",
        "North County Housing Network",
        null,
      ],
      [
        "Community Housing Access",
        "HHAP",
        "hhap",
        2,
        "sam",
        "Community Access Partners",
        6,
      ],
      [
        "Coastal Supportive Housing",
        "CoC",
        "coc",
        2,
        "sam",
        "Coastal Housing Collaborative",
        12,
      ],
      [
        "Fresh Start Housing",
        "Other",
        "active",
        5,
        "casey",
        "Fresh Start Community Services",
        -1,
      ],
      [
        "Neighborhood Housing Partnership",
        "HHAP",
        "hhap",
        9,
        "jordan",
        "Neighborhood Partners",
        20,
      ],
    ] as const;
    demos.forEach(
      (
        [
          name,
          programId,
          templateId,
          startingPosition,
          managerId,
          organization,
          days,
        ],
        i,
      ) => {
        const grantId = createGrant(
          {
            name,
            programId,
            templateId,
            startingPosition,
            managerId,
            organization,
            cycleId:
              programId === "Other" ? null : `demo-${programId.toLowerCase()}`,
            externalId: `DEMO-${1001 + i}`,
            requested: (350000 + i * 75000) * 100,
            awarded: i % 2 === 0 ? (300000 + i * 50000) * 100 : null,
          },
          actor,
          true,
        );
        const stage = db
          .select()
          .from(s.stages)
          .all()
          .find(
            (x) => x.grantId === grantId && x.position === startingPosition,
          )!;
        updateStage(
          grantId,
          {
            ownerId: managerId,
            externalParty: stage.externalParty,
            duration: stage.duration,
            plannedStart: null,
            deadline: days === null ? null : addDays(today(), days),
            estimated: true,
            status: i === 2 ? "Blocked" : "In Progress",
          },
          actor,
        );
        addComment(
          grantId,
          stage.id,
          [
            "Budget review is underway. Finance will confirm the final scope.",
            "Materials shared with the independent committee for review.",
            "Waiting for the recipient’s revised reporting schedule.",
            "Awaiting an external decision. No announcement date assumed.",
          ][i % 4],
          "Update",
          actor,
        );
      },
    );
  });
}
