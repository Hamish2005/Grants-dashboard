export const importFields = [
  "name",
  "programId",
  "cycle",
  "organization",
  "externalId",
  "requested",
  "awarded",
  "applicationDeadline",
  "startDate",
  "endDate",
  "reporting",
  "milestones",
] as const;
export type ImportField = (typeof importFields)[number];
export const aliases: Record<ImportField, string[]> = {
  name: ["grant name", "project title", "project name", "name"],
  programId: ["funding program", "program", "programid"],
  cycle: ["funding cycle", "year", "cycle"],
  organization: [
    "organization",
    "applicant",
    "recipient",
    "applicant organization",
  ],
  externalId: ["grant id", "application id", "externalid", "external grant id"],
  requested: ["requested amount", "funding requested", "requested"],
  awarded: ["awarded amount", "funding awarded", "awarded"],
  applicationDeadline: ["application deadline", "deadline"],
  startDate: ["contract start date", "start date", "startdate"],
  endDate: ["contract end date", "end date", "enddate"],
  reporting: ["reporting requirements", "reporting"],
  milestones: ["important milestones", "milestones"],
};
export function suggestMapping(headers: string[]) {
  return Object.fromEntries(
    importFields.map((f) => [
      f,
      headers.find((h) => aliases[f].includes(h.toLowerCase().trim())) || "",
    ]),
  );
}
export function mappedRow(
  row: Record<string, string>,
  mapping: Record<string, string>,
) {
  const result: Record<string, unknown> = {};
  for (const field of importFields) {
    const value = row[mapping[field]]?.trim();
    if (!value) continue;
    if (field === "requested" || field === "awarded") {
      const dollars = Number(value.replace(/[$,]/g, ""));
      if (!Number.isFinite(dollars) || dollars < 0)
        throw new Error(`Invalid ${field} amount`);
      result[field] = Math.round(dollars * 100);
    } else if (field === "programId") {
      const program = ["HHAP", "CoC", "YHDP", "Other"].find(
        (x) => x.toLowerCase() === value.toLowerCase(),
      );
      if (!program) throw new Error("Unknown funding program");
      result[field] = program;
    } else result[field] = value;
  }
  return result;
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
