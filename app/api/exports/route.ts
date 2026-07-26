import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { activities, boardPosts, boardSections, boards, responses, sessions } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id")?.trim();
  if (!id || !["session", "board"].includes(type ?? "")) return Response.json({ error: "내보낼 자료를 확인해 주세요." }, { status: 400 });

  const db = getDb();
  if (type === "session") {
    const [owned] = await db.select().from(sessions).where(and(eq(sessions.id, id), eq(sessions.ownerEmail, user.email))).limit(1);
    if (!owned) return Response.json({ error: "내보내기 권한이 없습니다." }, { status: 403 });
    const rows = await db.select({
      activityPosition: activities.position,
      activityType: activities.type,
      question: activities.prompt,
      participantId: responses.participantId,
      answer: responses.answer,
      submittedAt: responses.createdAt,
    }).from(activities).leftJoin(responses, eq(responses.activityId, activities.id))
      .where(eq(activities.sessionId, id)).orderBy(asc(activities.position), asc(responses.createdAt));
    return Response.json({
      title: owned.title,
      columns: ["문항 번호", "유형", "질문", "참여자 ID", "응답", "제출 시각"],
      rows: rows.map((row) => [row.activityPosition + 1, row.activityType, row.question, row.participantId ?? "", row.answer ?? "", row.submittedAt ?? ""]),
    });
  }

  const [owned] = await db.select().from(boards).where(and(eq(boards.id, id), eq(boards.ownerEmail, user.email))).limit(1);
  if (!owned) return Response.json({ error: "내보내기 권한이 없습니다." }, { status: 403 });
  const rows = await db.select({
    sectionPosition: boardSections.position,
    section: boardSections.title,
    author: boardPosts.authorName,
    participantId: boardPosts.participantId,
    content: boardPosts.content,
    fileName: boardPosts.fileName,
    submittedAt: boardPosts.createdAt,
  }).from(boardSections).leftJoin(boardPosts, eq(boardPosts.sectionId, boardSections.id))
    .where(eq(boardSections.boardId, id)).orderBy(asc(boardSections.position), asc(boardPosts.createdAt));
  return Response.json({
    title: owned.title,
    columns: ["섹션 번호", "섹션", "작성자", "참여자 ID", "의견", "첨부 파일", "게시 시각"],
    rows: rows.map((row) => [row.sectionPosition + 1, row.section, row.author ?? "", row.participantId ?? "", row.content ?? "", row.fileName ?? "", row.submittedAt ?? ""]),
  });
}
