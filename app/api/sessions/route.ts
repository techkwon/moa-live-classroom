import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { activities, responses, sessions } from "../../../db/schema";

export const dynamic = "force-dynamic";

const prompts = [
  { type: "quiz" as const, prompt: "AI가 수업을 바꾸는 가장 큰 힘은?", options: ["빠른 정답 찾기", "모두의 생각 연결하기", "숙제 자동 채점", "교사를 대신하기"] },
  { type: "cloud" as const, prompt: "오늘 수업을 한 단어로 표현해 주세요", options: null },
  { type: "open" as const, prompt: "내일 바로 적용해 보고 싶은 것은?", options: null },
];

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { action?: string; code?: string; activityId?: string; participantId?: string; answer?: string };
    const db = getDb();

    if (payload.action === "create") {
      const id = crypto.randomUUID();
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await db.insert(sessions).values({ id, code, title: "AI로 여는 참여 수업" });
      await db.insert(activities).values(prompts.map((item, position) => ({
        id: crypto.randomUUID(), sessionId: id, type: item.type, prompt: item.prompt,
        options: item.options ? JSON.stringify(item.options) : null, position, isActive: position === 0,
      })));
      return Response.json({ id, code }, { status: 201 });
    }

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
    const [session] = await db.select().from(sessions).where(eq(sessions.code, code)).limit(1);
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
