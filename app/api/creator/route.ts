import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { activities, sessions } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

type ActivityInput = {
  type?: "quiz" | "cloud" | "open";
  prompt?: string;
  options?: string[];
  correctIndex?: number;
  correctIndices?: number[];
  hasCorrectAnswer?: boolean;
  cloudShape?: "scatter" | "circle" | "heart" | "speech";
};

async function authenticatedUser() {
  const user = await getChatGPTUser();
  if (!user) return null;
  return user;
}

export async function GET(request: Request) {
  const user = await authenticatedUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  try {
    const db = getDb();
    const sessionId = new URL(request.url).searchParams.get("id");
    if (sessionId) {
      const [session] = await db.select().from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.ownerEmail, user.email))).limit(1);
      if (!session) return Response.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
      const items = await db.select().from(activities).where(eq(activities.sessionId, session.id)).orderBy(asc(activities.position));
      return Response.json({ session, activities: items });
    }
    const rows = await db
      .select({
        id: sessions.id,
        code: sessions.code,
        title: sessions.title,
        status: sessions.status,
        createdAt: sessions.createdAt,
        activityCount: sql<number>`count(${activities.id})`,
      })
      .from(sessions)
      .leftJoin(activities, eq(activities.sessionId, sessions.id))
      .where(eq(sessions.ownerEmail, user.email))
      .groupBy(sessions.id)
      .orderBy(desc(sessions.createdAt));
    return Response.json({ sessions: rows });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "세션을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await authenticatedUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  try {
    const payload = await request.json() as { action?: string; sessionId?: string; activityId?: string; accepting?: boolean; revealAnswer?: boolean; joinOpen?: boolean; title?: string; launch?: boolean; activities?: ActivityInput[] };
    const db = getDb();
    if (payload.action === "activate") {
      const sessionId = payload.sessionId?.trim();
      const activityId = payload.activityId?.trim();
      if (!sessionId || !activityId) return Response.json({ error: "세션과 활동 정보가 필요합니다." }, { status: 400 });
      const [owned] = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.ownerEmail, user.email))).limit(1);
      const [target] = await db.select({ id: activities.id }).from(activities).where(and(eq(activities.id, activityId), eq(activities.sessionId, sessionId))).limit(1);
      if (!owned || !target) return Response.json({ error: "변경 권한이 없습니다." }, { status: 403 });
      await db.update(activities).set({ isActive: false }).where(eq(activities.sessionId, sessionId));
      await db.update(activities).set({ isActive: true, accepting: true, revealAnswer: false }).where(eq(activities.id, activityId));
      await db.update(sessions).set({ status: "live" }).where(eq(sessions.id, sessionId));
      return Response.json({ ok: true });
    }
    if (payload.action === "control") {
      const sessionId = payload.sessionId?.trim();
      const activityId = payload.activityId?.trim();
      if (!sessionId || !activityId) return Response.json({ error: "세션과 활동 정보가 필요합니다." }, { status: 400 });
      const [owned] = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.ownerEmail, user.email))).limit(1);
      const [target] = await db.select({ id: activities.id }).from(activities).where(and(eq(activities.id, activityId), eq(activities.sessionId, sessionId))).limit(1);
      if (!owned || !target) return Response.json({ error: "변경 권한이 없습니다." }, { status: 403 });
      await db.update(activities).set({
        ...(typeof payload.accepting === "boolean" ? { accepting: payload.accepting } : {}),
        ...(typeof payload.revealAnswer === "boolean" ? { revealAnswer: payload.revealAnswer } : {}),
      }).where(eq(activities.id, activityId));
      return Response.json({ ok: true });
    }
    if (payload.action === "access") {
      const sessionId = payload.sessionId?.trim();
      if (!sessionId || typeof payload.joinOpen !== "boolean") return Response.json({ error: "참여 허용 정보가 필요합니다." }, { status: 400 });
      const [owned] = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.ownerEmail, user.email))).limit(1);
      if (!owned) return Response.json({ error: "변경 권한이 없습니다." }, { status: 403 });
      await db.update(sessions).set({ joinOpen: payload.joinOpen }).where(eq(sessions.id, sessionId));
      return Response.json({ ok: true, joinOpen: payload.joinOpen });
    }
    if (payload.action !== "save") return Response.json({ error: "지원하지 않는 요청입니다." }, { status: 400 });
    const title = payload.title?.trim();
    const inputs = payload.activities ?? [];
    if (!title || inputs.length === 0 || inputs.length > 50) return Response.json({ error: "제목과 1~50개의 활동이 필요합니다." }, { status: 400 });
    const normalized = inputs.map((item, index) => {
      const type = item.type;
      const prompt = item.prompt?.trim();
      if (!type || !["quiz", "cloud", "open"].includes(type) || !prompt) throw new Error(`${index + 1}번 활동을 확인해 주세요.`);
      const options = type === "quiz" ? (item.options ?? []).map((value) => value.trim()).filter(Boolean) : [];
      if (type === "quiz" && options.length < 2) throw new Error(`${index + 1}번 퀴즈에는 선택지가 2개 이상 필요합니다.`);
      const hasCorrectAnswer = item.type === "quiz" && item.hasCorrectAnswer !== false;
      const rawCorrect = hasCorrectAnswer ? (item.correctIndices?.length ? item.correctIndices : [item.correctIndex ?? 0]) : [];
      const correctIndices = [...new Set(rawCorrect.map((value) => Math.min(Math.max(value, 0), Math.max(options.length - 1, 0))))].sort((a, b) => a - b);
      const cloudShape = ["scatter","circle","heart","speech"].includes(item.cloudShape ?? "") ? item.cloudShape : "scatter";
      return { type, prompt, options, correctIndices, hasCorrectAnswer, cloudShape };
    });

    const sessionId = payload.sessionId?.trim() || crypto.randomUUID();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (payload.sessionId) {
      const [owned] = await db.select({ id: sessions.id, code: sessions.code }).from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.ownerEmail, user.email))).limit(1);
      if (!owned) return Response.json({ error: "수정 권한이 없습니다." }, { status: 403 });
      await db.update(sessions).set({ title, status: payload.launch ? "live" : "draft", joinOpen: false }).where(eq(sessions.id, sessionId));
      await db.delete(activities).where(eq(activities.sessionId, sessionId));
    } else {
      await db.insert(sessions).values({ id: sessionId, code, title, ownerEmail: user.email, status: payload.launch ? "live" : "draft", joinOpen: false });
    }
    await db.insert(activities).values(normalized.map((item, position) => ({
      id: crypto.randomUUID(),
      sessionId,
      type: item.type,
      prompt: item.prompt,
      options: item.type === "quiz"
        ? JSON.stringify({ choices: item.options, correctIndices: item.correctIndices, hasCorrectAnswer: item.hasCorrectAnswer })
        : item.type === "cloud" ? JSON.stringify({ cloudShape: item.cloudShape }) : null,
      position,
      isActive: Boolean(payload.launch && position === 0),
    })));
    const [saved] = await db.select({ code: sessions.code }).from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    return Response.json({ id: sessionId, code: saved.code, status: payload.launch ? "live" : "draft" }, { status: payload.sessionId ? 200 : 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "세션을 저장하지 못했습니다." }, { status: 500 });
  }
}
