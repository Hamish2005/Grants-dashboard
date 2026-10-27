"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, ArrowRight, CalendarDays, CheckSquare } from "lucide-react";
import { matchesWorkView, type WorkItem } from "@/lib/work-items";
import { dateLabel } from "@/lib/utils";
import { PageHeading, DemoNotice, Status, Empty, Badge } from "./common";
import { ActionButton } from "./forms";
import { Button } from "./ui/button";
export function WorkQueue({
  items,
  mode,
  userId,
  role,
  day,
}: {
  items: WorkItem[];
  mode: "tasks" | "deadlines";
  userId: string;
  role: string;
  day: string;
}) {
  const mine = mode === "tasks";
  const initialView = mine ? "all" : "week";
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [owner, setOwner] = useState("");
  const scoped = items.filter((item) => !mine || item.ownerId === userId);
  const tabs = mine
    ? [
        ["all", "All my tasks"],
        ["week", "Due in 7 days"],
        ["overdue", "Overdue"],
        ["blocked", "Blocked"],
        ["waiting", "External decisions"],
        ["paused", "On hold"],
      ]
    : [
        ["week", "Next 7 days"],
        ["month", "Next 30 days"],
        ["upcoming", "All upcoming"],
        ["overdue", "Overdue"],
        ["unscheduled", "Unscheduled"],
        ["paused", "On hold"],
      ];
  const filtered = scoped.filter(
    (item) =>
      matchesWorkView(item, view, day) &&
      (!query ||
        `${item.name} ${item.grantName}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!kind || item.kind === kind) &&
      (!owner || item.ownerId === owner),
  );
  const counts = (value: string) =>
    scoped.filter((item) => matchesWorkView(item, value, day)).length;
  return (
    <>
      <PageHeading
        eyebrow="GRANTS & CONTRACTS"
        title={mine ? "My tasks" : "Upcoming deadlines"}
        description={
          mine
            ? "Your assigned stages and open reporting obligations."
            : "Stage deadlines and reporting obligations across your grants. Dates use Pacific Time."
        }
      />
      {scoped.some((item) => item.demo) && <DemoNotice />}
      <section className="panel work-queue">
        <div className="section-heading">
          <div>
            <h2>
              {mine ? <CheckSquare size={18} /> : <CalendarDays size={18} />}{" "}
              {mine ? "Assigned to me" : "Deadline schedule"}{" "}
              <span className="count">{filtered.length}</span>
            </h2>
            <p>
              {mine
                ? "Open a stage to update progress, or complete a reporting task here."
                : "Choose a date window. Overdue items and paused work have their own views."}
            </p>
          </div>
        </div>
        <div
          className="tracker-tabs work-tabs"
          aria-label={mine ? "Task views" : "Deadline views"}
        >
          {tabs.map(([value, label]) => (
            <button
              key={value}
              aria-pressed={view === value}
              className={view === value ? "active" : ""}
              onClick={() => setView(value)}
            >
              {label} <span>{counts(value)}</span>
            </button>
          ))}
        </div>
        <div className="toolbar">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Search tasks and deadlines"
              placeholder="Search tasks or grants…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Work type"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">All work types</option>
            <option value="Stage">Lifecycle stages</option>
            <option value="Reporting">Reporting tasks</option>
          </select>
          {!mine && (
            <select
              aria-label="Assigned owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value="">All owners</option>
              {Array.from(
                new Map(scoped.map((i) => [i.ownerId, i.ownerName])),
              ).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              setQuery("");
              setKind("");
              setOwner("");
              setView(initialView);
            }}
          >
            Reset filters
          </Button>
        </div>
        {!filtered.length ? (
          <Empty
            title={mine ? "No tasks in this view" : "No deadlines in this view"}
            detail={
              query || kind || owner
                ? "Reset filters to see more items."
                : mine
                  ? "Assignments appear here when you own a current stage or an open reporting task."
                  : "Try a longer date window, or check overdue and unscheduled work."
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="grants-table work-table">
              <thead>
                <tr>
                  <th>Task / grant</th>
                  <th>Type</th>
                  <th>Assigned to</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.kind + item.id}>
                    <td>
                      <Link
                        className="grant-name"
                        href={`/grants/${item.grantId}`}
                      >
                        {item.name}
                      </Link>
                      <small>
                        {item.grantName} · {item.programId}
                      </small>
                      {item.externalParty && (
                        <small>External: {item.externalParty}</small>
                      )}
                    </td>
                    <td>
                      <Badge
                        tone={item.kind === "Reporting" ? "blue" : "neutral"}
                      >
                        {item.kind === "Reporting"
                          ? "Reporting task"
                          : "Lifecycle stage"}
                      </Badge>
                      {item.intervalDays && (
                        <small>Every {item.intervalDays} days</small>
                      )}
                    </td>
                    <td>{item.ownerName}</td>
                    <td>
                      <span
                        className={
                          !item.paused && item.deadline && item.deadline < day
                            ? "deadline-overdue"
                            : ""
                        }
                      >
                        {dateLabel(item.deadline)}
                      </span>
                      {item.deadline && (
                        <small>
                          {item.estimated ? "Estimated" : "Confirmed"}
                        </small>
                      )}
                    </td>
                    <td>
                      <Status
                        value={
                          item.paused
                            ? "On Hold"
                            : item.status === "Blocked"
                              ? "Blocked"
                              : item.deadline && item.deadline < day
                                ? "Overdue"
                                : item.status
                        }
                      />
                    </td>
                    <td>
                      {item.kind === "Reporting" &&
                      !item.paused &&
                      (role !== "Staff" || item.ownerId === userId) ? (
                        <ActionButton
                          body={{ action: "completeTask", id: item.id }}
                        >
                          Complete task
                        </ActionButton>
                      ) : (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/grants/${item.grantId}`}>
                            {item.kind === "Stage"
                              ? "Open stage"
                              : "View grant"}
                            <ArrowRight size={13} />
                          </Link>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          <span>
            {filtered.length} {filtered.length === 1 ? "item" : "items"} in this
            view
          </span>
          <span>Current stages and incomplete reporting tasks</span>
        </div>
      </section>
    </>
  );
}
