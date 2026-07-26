import { env } from "cloudflare:workers";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { boardPosts, boardSections, boards } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

async function boardPayload(boardId: string) {
  const db = getDb();
  const [board] = await db.select().from(boards).where(eq(boards.id, boardId)).limit(1);
  if (!board) return null;
  const sections = await db.select().from(boardSections).where(eq(boardSections.boardId, boardId)).orderBy(asc(boardSections.position));
  const posts = sections.length
    ? await db.select().from(boardPosts).innerJoin(boardSections, eq(boardPosts.sectionId, boardSections.id)).where(
        // D1 has no array binding in this route; the join keeps the board boundary explicit.
        eq(boardSections.boardId, boardId),
      ).orderBy(desc(boardPosts.createdAt))
    : [];
  return {
    board,
    sections: sections.map((section) => ({
      ...section,
      posts: posts.filter((row) => row.board_posts.sectionId === section.id).map((row) => row.board_posts),
    })),
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code")?.replace(/\D/g, "");
    const id = url.searchParams.get("id");
    const db = getDb();
    if (code) {
      const [board] = await db.select({ id: boards.id }).from(boards).where(eq(boards.code, code)).limit(1);
      if (!board) return Response.json({ error: "보드를 찾을 수 없습니다." }, { status: 404 });
      return Response.json(await boardPayload(board.id));
    }
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    if (id) {
      const [owned] = await db.select({ id: boards.id }).from(boards).where(and(eq(boards.id, id), eq(boards.ownerEmail, user.email))).limit(1);
      if (!owned) return Response.json({ error: "보드를 찾을 수 없습니다." }, { status: 404 });
      return Response.json(await boardPayload(owned.id));
    }
    return Response.json({ boards: await db.select().from(boards).where(eq(boards.ownerEmail, user.email)).orderBy(desc(boards.createdAt)) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "보드를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) return createPost(request);
    const payload = await request.json() as { action?: string; boardId?: string; sectionId?: string; postId?: string; title?: string; description?: string; sections?: string[] };
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const db = getDb();

    if (payload.action === "create") {
      const title = payload.title?.trim();
      const sectionNames = (payload.sections ?? []).map((value) => value.trim()).filter(Boolean);
      if (!title || sectionNames.length === 0 || sectionNames.length > 20) return Response.json({ error: "보드 제목과 1~20개의 섹션이 필요합니다." }, { status: 400 });
      const boardId = crypto.randomUUID();
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await db.insert(boards).values({ id: boardId, code, title, description: payload.description?.trim() ?? "", ownerEmail: user.email });
      await db.insert(boardSections).values(sectionNames.map((name, position) => ({ id: crypto.randomUUID(), boardId, title: name, position })));
      return Response.json({ id: boardId, code }, { status: 201 });
    }

    const boardId = payload.boardId?.trim();
    if (!boardId) return Response.json({ error: "보드 정보가 필요합니다." }, { status: 400 });
    const [owned] = await db.select({ id: boards.id }).from(boards).where(and(eq(boards.id, boardId), eq(boards.ownerEmail, user.email))).limit(1);
    if (!owned) return Response.json({ error: "관리 권한이 없습니다." }, { status: 403 });

    if (payload.action === "addSection") {
      const title = payload.title?.trim();
      if (!title) return Response.json({ error: "섹션 이름이 필요합니다." }, { status: 400 });
      const existing = await db.select().from(boardSections).where(eq(boardSections.boardId, boardId));
      if (existing.length >= 20) return Response.json({ error: "섹션은 최대 20개까지 만들 수 있습니다." }, { status: 400 });
      await db.insert(boardSections).values({ id: crypto.randomUUID(), boardId, title, position: existing.length });
      return Response.json({ ok: true });
    }

    if (payload.action === "renameSection") {
      const title = payload.title?.trim();
      const sectionId = payload.sectionId?.trim();
      if (!title || !sectionId) return Response.json({ error: "섹션 정보가 필요합니다." }, { status: 400 });
      await db.update(boardSections).set({ title }).where(and(eq(boardSections.id, sectionId), eq(boardSections.boardId, boardId)));
      return Response.json({ ok: true });
    }

    if (payload.action === "deletePost") {
      const postId = payload.postId?.trim();
      if (!postId) return Response.json({ error: "게시글 정보가 필요합니다." }, { status: 400 });
      const [post] = await db.select({ id: boardPosts.id, fileKey: boardPosts.fileKey }).from(boardPosts)
        .innerJoin(boardSections, eq(boardPosts.sectionId, boardSections.id))
        .where(and(eq(boardPosts.id, postId), eq(boardSections.boardId, boardId))).limit(1);
      if (!post) return Response.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
      if (post.fileKey) await env.UPLOADS.delete(post.fileKey);
      await db.delete(boardPosts).where(eq(boardPosts.id, post.id));
      return Response.json({ ok: true });
    }
    return Response.json({ error: "지원하지 않는 요청입니다." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "보드 요청을 처리하지 못했습니다." }, { status: 500 });
  }
}

async function createPost(request: Request) {
  const form = await request.formData();
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  const sectionId = String(form.get("sectionId") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  const authorName = String(form.get("authorName") ?? "").trim().slice(0, 30);
  const content = String(form.get("content") ?? "").trim().slice(0, 2000);
  const file = form.get("file");
  if (!code || !sectionId || !participantId || !authorName || (!content && !(file instanceof File && file.size))) return Response.json({ error: "이름과 의견 또는 파일을 입력해 주세요." }, { status: 400 });
  const db = getDb();
  const [section] = await db.select({ id: boardSections.id }).from(boardSections).innerJoin(boards, eq(boardSections.boardId, boards.id))
    .where(and(eq(boardSections.id, sectionId), eq(boards.code, code))).limit(1);
  if (!section) return Response.json({ error: "게시할 섹션을 찾을 수 없습니다." }, { status: 404 });
  let fileKey: string | null = null;
  let fileName: string | null = null;
  let fileType: string | null = null;
  let fileSize: number | null = null;
  if (file instanceof File && file.size) {
    if (file.size > 10 * 1024 * 1024) return Response.json({ error: "파일은 10MB 이하만 첨부할 수 있습니다." }, { status: 413 });
    const blocked = ["application/x-msdownload", "application/x-sh", "application/x-bat"];
    if (blocked.includes(file.type)) return Response.json({ error: "이 파일 형식은 첨부할 수 없습니다." }, { status: 415 });
    fileKey = `boards/${sectionId}/${crypto.randomUUID()}`;
    fileName = file.name.slice(0, 180);
    fileType = file.type || "application/octet-stream";
    fileSize = file.size;
    await env.UPLOADS.put(fileKey, await file.arrayBuffer(), { httpMetadata: { contentType: fileType }, customMetadata: { fileName } });
  }
  const post = { id: crypto.randomUUID(), sectionId, participantId, authorName, content, fileKey, fileName, fileType, fileSize };
  await db.insert(boardPosts).values(post);
  return Response.json({ post }, { status: 201 });
}
