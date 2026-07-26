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
    const payload = await request.json() as { action?: string; sessionId?: string; title?: string; launch?: boolean; activities?: ActivityInput[] };
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
      return { type, prompt, options, correctIndex: Math.min(Math.max(item.correctIndex ?? 0, 0), Math.max(options.length - 1, 0)) };
    });

    const db = getDb();
    const sessionId = payload.sessionId?.trim() || crypto.randomUUID();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (payload.sessionId) {
      const [owned] = await db.select({ id: sessions.id, code: sessions.code }).from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.ownerEmail, user.email))).limit(1);
      if (!owned) return Response.json({ error: "수정 권한이 없습니다." }, { status: 403 });
      await db.update(sessions).set({ title, status: payload.launch ? "live" : "draft" }).where(eq(sessions.id, sessionId));
      await db.delete(activities).where(eq(activities.sessionId, sessionId));
    } else {
      await db.insert(sessions).values({ id: sessionId, code, title, ownerEmail: user.email, status: payload.launch ? "live" : "draft" });
    }
    await db.insert(activities).values(normalized.map((item, position) => ({
      id: crypto.randomUUID(),
      sessionId,
      type: item.type,
      prompt: item.prompt,
      options: item.type === "quiz" ? JSON.stringify({ choices: item.options, correctIndex: item.correctIndex }) : null,
      position,
      isActive: Boolean(payload.launch && position === 0),
    })));
    const [saved] = await db.select({ code: sessions.code }).from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    return Response.json({ id: sessionId, code: saved.code, status: payload.launch ? "live" : "draft" }, { status: payload.sessionId ? 200 : 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "세션을 저장하지 못했습니다." }, { status: 500 });
  }
}
