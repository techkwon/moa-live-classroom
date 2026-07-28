import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { activities, responseLikes, responses, sessionReactions, sessions } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { action?: string; code?: string; sessionId?: string; activityId?: string; responseId?: string; participantId?: string; answer?: string; emoji?: string };
    const db = getDb();

    if (payload.action === "respond") {
      const activityId = payload.activityId?.trim();
      const participantId = payload.participantId?.trim();
      const answer = payload.answer?.trim();
      if (!activityId || !participantId || !answer) return Response.json({ error: "응답 정보가 부족합니다." }, { status: 400 });
      const [activity] = await db.select({ accepting: activities.accepting, isActive: activities.isActive, joinOpen: sessions.joinOpen }).from(activities)
        .innerJoin(sessions, eq(activities.sessionId, sessions.id)).where(eq(activities.id, activityId)).limit(1);
      if (!activity?.joinOpen) return Response.json({ error: "진행자가 아직 참여를 허용하지 않았습니다." }, { status: 403 });
      if (!activity?.isActive) return Response.json({ error: "현재 진행 중인 문항에만 응답하거나 수정할 수 있습니다." }, { status: 409 });
      if (!activity.accepting) return Response.json({ error: "응답이 마감되었습니다." }, { status: 409 });
      await db.insert(responses).values({ id: crypto.randomUUID(), activityId, participantId, answer })
        .onConflictDoUpdate({ target: [responses.activityId, responses.participantId], set: { answer, createdAt: sql`CURRENT_TIMESTAMP` } });
      return Response.json({ ok: true });
    }

    if (payload.action === "react") {
      const sessionId = payload.sessionId?.trim();
      const participantId = payload.participantId?.trim();
      const emoji = payload.emoji?.trim();
      if (!sessionId || !participantId || !emoji || !["😊","🤔","😮","👏","❤️"].includes(emoji)) return Response.json({ error: "감정 반응 정보가 올바르지 않습니다." }, { status: 400 });
      const [openSession] = await db.select({ joinOpen: sessions.joinOpen }).from(sessions).where(eq(sessions.id, sessionId)).limit(1);
      if (!openSession?.joinOpen) return Response.json({ error: "참여 세션이 닫혀 있습니다." }, { status: 403 });
      await db.insert(sessionReactions).values({ id: crypto.randomUUID(), sessionId, participantId, emoji })
        .onConflictDoUpdate({ target: [sessionReactions.sessionId, sessionReactions.participantId], set: { emoji, updatedAt: sql`CURRENT_TIMESTAMP` } });
      return Response.json({ ok: true });
    }

    if (payload.action === "like") {
      const responseId = payload.responseId?.trim();
      const participantId = payload.participantId?.trim();
      if (!responseId || !participantId) return Response.json({ error: "좋아요 정보가 부족합니다." }, { status: 400 });
      const [openSession] = await db.select({ joinOpen: sessions.joinOpen }).from(responses)
        .innerJoin(activities, eq(responses.activityId, activities.id)).innerJoin(sessions, eq(activities.sessionId, sessions.id))
        .where(eq(responses.id, responseId)).limit(1);
      if (!openSession?.joinOpen) return Response.json({ error: "참여 세션이 닫혀 있습니다." }, { status: 403 });
      const [existing] = await db.select({ id: responseLikes.id }).from(responseLikes).where(and(eq(responseLikes.responseId, responseId), eq(responseLikes.participantId, participantId))).limit(1);
      if (existing) await db.delete(responseLikes).where(eq(responseLikes.id, existing.id));
      else await db.insert(responseLikes).values({ id: crypto.randomUUID(), responseId, participantId });
      return Response.json({ ok: true, liked: !existing });
    }

    return Response.json({ error: "지원하지 않는 요청입니다." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "요청을 처리하지 못했습니다." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code")?.replace(/\D/g, "");
    if (!code) return Response.json({ error: "참여 코드가 필요합니다." }, { status: 400 });
    const db = getDb();
    const [session] = await db.select().from(sessions).where(and(eq(sessions.code, code), eq(sessions.status, "live"))).limit(1);
    if (!session) return Response.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
    if (!session.joinOpen) {
      const user = url.searchParams.get("presenter") === "1" ? await getChatGPTUser() : null;
      if (!user || session.ownerEmail !== user.email) return Response.json({ error: "진행자가 아직 참여를 허용하지 않았습니다." }, { status: 403 });
    }
    const items = await db.select().from(activities).where(eq(activities.sessionId, session.id)).orderBy(asc(activities.position));
    const active = items.find((item) => item.isActive) ?? items[0];
    const storedOptions = active?.options ? JSON.parse(active.options) as { choices?: string[]; correctIndex?: number; correctIndices?: number[]; cloudShape?: string } : {};
    const publicActive = active ? {
      ...active,
      options: storedOptions.choices ? JSON.stringify(storedOptions.choices) : null,
      multiSelect: (storedOptions.correctIndices?.length ?? 1) > 1,
      correctIndices: active.revealAnswer ? (storedOptions.correctIndices ?? []) : [],
      cloudShape: storedOptions.cloudShape ?? "scatter",
    } : null;
    const result = !active ? [] : active.type === "open"
      ? await db.select({ id: responses.id, answer: responses.answer, count: sql<number>`1`, likes: sql<number>`count(${responseLikes.id})` }).from(responses)
        .leftJoin(responseLikes, eq(responseLikes.responseId, responses.id)).where(eq(responses.activityId, active.id)).groupBy(responses.id).orderBy(desc(responses.createdAt)).limit(100)
      : await db.select({ answer: responses.answer, count: sql<number>`count(*)` }).from(responses)
        .where(eq(responses.activityId, active.id)).groupBy(responses.answer);
    const reactions = await db.select({ emoji: sessionReactions.emoji, count: sql<number>`count(*)` }).from(sessionReactions)
      .where(eq(sessionReactions.sessionId, session.id)).groupBy(sessionReactions.emoji);
    return Response.json({ session, active: publicActive, results: result, reactions });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "세션을 불러오지 못했습니다." }, { status: 500 });
  }
}
