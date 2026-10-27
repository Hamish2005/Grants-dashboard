import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { getGrant, referenceData } from "@/lib/grants";
import { GrantDetail } from "@/components/grant-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  const { id } = await params;
  const exists = db.select().from(s.grants).where(eq(s.grants.id, id)).get();
  if (!exists) notFound();
  const grant = getGrant(id);
  const comments = db
    .select({
      id: s.comments.id,
      stageId: s.comments.stageId,
      authorId: s.comments.authorId,
      text: s.comments.text,
      indicator: s.comments.indicator,
      createdAt: s.comments.createdAt,
    })
    .from(s.comments)
    .innerJoin(s.stages, eq(s.comments.stageId, s.stages.id))
    .where(eq(s.stages.grantId, id))
    .orderBy(desc(s.comments.createdAt))
    .all();
  return (
    <GrantDetail
      key={grant.id}
      grant={grant}
      refs={referenceData()}
      user={user}
      comments={comments}
      documents={db
        .select()
        .from(s.documents)
        .where(eq(s.documents.grantId, id))
        .all()}
      audit={db
        .select()
        .from(s.auditLogs)
        .where(eq(s.auditLogs.grantId, id))
        .orderBy(desc(s.auditLogs.createdAt))
        .all()}
      tasks={db.select().from(s.tasks).where(eq(s.tasks.grantId, id)).all()}
    />
  );
}
