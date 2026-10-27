import { cn } from "@/lib/utils";
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={cn("badge", `badge-${tone}`)}>
      <span className="status-dot" />
      {children}
    </span>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <Badge
      tone={
        value === "Blocked" || value === "Overdue"
          ? "red"
          : value === "Completed" || value === "Closed"
            ? "green"
            : value === "In Progress" || value === "Active"
              ? "blue"
              : value === "On Hold"
                ? "amber"
                : "neutral"
      }
    >
      {value}
    </Badge>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="heading-actions">{actions}</div>
    </div>
  );
}
export function DemoNotice() {
  return (
    <div className="demo-notice">
      <span className="demo-dot" />
      Demo workspace{" "}
      <span>
        All sample grants, organizations, amounts, and deadlines are fictional.
      </span>
    </div>
  );
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}
