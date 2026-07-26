import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { activities, responses, sessions } from "../../../db/schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { action?: string; code?: string; activityId?: string; participantId?: string; answer?: string };
    const db = getDb();

    if (payload.action === "respond") {
      const activityId = payload.activityId?.trim();
      const participantId = payload.participantId?.trim();
      const answer = payload.answer?.trim();
      if (!activityId || !participantId || !answer) return Response.json({ error: "응답 정보가 부족합니다." }, { status: 400 });
      await db.insert(responses).values({ id: crypto.randomUUID(), activityId, participantId, answer })
        .onConflictDoUpdate({ target: [responses.activityId, responses.participantId], set: { answer, createdAt: sql`CURRENT_TIMESTAMP` } });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "지원하지 않는 요청입니다." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "요청을 처리하지 못했습니다." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const code = new URL(request.url).searchParams.get("code")?.replace(/\D/g, "");
    if (!code) return Response.json({ error: "참여 코드가 필요합니다." }, { status: 400 });
    const db = getDb();
    const [session] = await db.select().from(sessions).where(and(eq(sessions.code, code), eq(sessions.status, "live"))).limit(1);
    if (!session) return Response.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
    const items = await db.select().from(activities).where(eq(activities.sessionId, session.id)).orderBy(asc(activities.position));
    const active = items.find((item) => item.isActive) ?? items[0];
    const result = active ? await db.select({ answer: responses.answer, count: sql<number>`count(*)` }).from(responses)
      .where(and(eq(responses.activityId, active.id))).groupBy(responses.answer) : [];
    return Response.json({ session, activities: items, active, results: result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "세션을 불러오지 못했습니다." }, { status: 500 });
  }
}
