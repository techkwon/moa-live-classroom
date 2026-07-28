import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "../../../db";
import { activities, sessions } from "../../../db/schema";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { Presenter } from "./Presenter";

export const dynamic = "force-dynamic";

export default async function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireChatGPTUser(`/present/${id}`);
  const db = getDb();
  const [session] = await db.select().from(sessions).where(and(eq(sessions.id, id), eq(sessions.ownerEmail, user.email))).limit(1);
  if (!session) notFound();
  const items = await db.select().from(activities).where(eq(activities.sessionId, id)).orderBy(asc(activities.position));
  return <Presenter session={{ id: session.id, title: session.title, code: session.code, joinOpen: session.joinOpen }} activities={items} />;
}
