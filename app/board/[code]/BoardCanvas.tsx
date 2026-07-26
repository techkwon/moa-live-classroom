"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Post = { id: string; authorName: string; content: string; fileKey: string | null; fileName: string | null; fileType: string | null; fileSize: number | null; createdAt: string };
type Section = { id: string; title: string; position: number; posts: Post[] };
type BoardData = { board: { id: string; code: string; title: string; description: string }; sections: Section[] };

export function BoardCanvas({ code, boardId, manage = false }: { code?: string; boardId?: string; manage?: boolean }) {
  const [data, setData] = useState<BoardData | null>(null);
  const [composer, setComposer] = useState("");
  const [name, setName] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem("moa-board-name") ?? "");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [newSection, setNewSection] = useState("");

  async function load() {
    const response = await fetch(`/api/boards?${manage ? `id=${boardId}` : `code=${code}`}`, { cache: "no-store" });
    if (response.ok) setData(await response.json() as BoardData);
  }
  useEffect(() => {
    void fetch(`/api/boards?${manage ? `id=${boardId}` : `code=${code}`}`, { cache: "no-store" }).then(async (response) => {
      if (response.ok) setData(await response.json() as BoardData);
    });
  }, [boardId, code, manage]);
  async function submitPost(event: FormEvent, sectionId: string) {
    event.preventDefault();
    if (!data) return;
    setBusy(true); setMessage("");
    const form = new FormData();
    form.set("code", data.board.code); form.set("sectionId", sectionId);
    const participantId = localStorage.getItem("moa-participant") ?? crypto.randomUUID();
    localStorage.setItem("moa-participant", participantId); localStorage.setItem("moa-board-name", name);
    form.set("participantId", participantId); form.set("authorName", name); form.set("content", content);
    if (file) form.set("file", file);
    const response = await fetch("/api/boards", { method: "POST", body: form });
    const result = await response.json() as { error?: string };
    if (response.ok) { setComposer(""); setContent(""); setFile(null); await load(); }
    else setMessage(result.error ?? "게시하지 못했습니다.");
    setBusy(false);
  }
  async function manageAction(payload: Record<string, string>) {
    if (!data) return;
    const response = await fetch("/api/boards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ boardId: data.board.id, ...payload }) });
    if (response.ok) { setNewSection(""); await load(); }
  }
  if (!data) return <main className="board-loading"><span className="brand-mark">M</span><p>보드를 불러오는 중…</p></main>;
  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}/board/${data.board.code}`;
  return (
    <main className="board-canvas">
      <div className="board-aurora" aria-hidden="true" />
      <header className="board-header">
        <div><Link className="brand" href={manage ? "/boards" : "/"}><span className="brand-mark">M</span><span>모아 보드</span></Link><p>{data.board.description}</p><h1>{data.board.title}</h1></div>
        <div className="board-header-actions"><span>참여 코드 <b>{data.board.code.slice(0,3)} {data.board.code.slice(3)}</b></span><button onClick={() => navigator.clipboard.writeText(shareUrl)}>링크 복사</button>{manage && <Link href={`/board/${data.board.code}`}>학생 화면 ↗</Link>}</div>
      </header>
      {manage && <div className="board-admin-bar"><b>교사 관리 모드</b><input placeholder="새 섹션 이름" value={newSection} onChange={(event) => setNewSection(event.target.value)} /><button onClick={() => newSection.trim() && void manageAction({ action: "addSection", title: newSection.trim() })}>＋ 섹션 추가</button></div>}
      <section className="section-board">
        {data.sections.map((section) => <article className="board-column" key={section.id}>
          <div className="column-head">{manage ? <input value={section.title} onChange={(event) => setData((current) => current ? { ...current, sections: current.sections.map((item) => item.id === section.id ? { ...item, title: event.target.value } : item) } : current)} onBlur={() => void manageAction({ action: "renameSection", sectionId: section.id, title: section.title })} /> : <h2>{section.title}</h2>}<span>{section.posts.length}</span></div>
          <button className="column-add" onClick={() => setComposer(composer === section.id ? "" : section.id)}>＋ 의견 남기기</button>
          {composer === section.id && <form className="post-composer" onSubmit={(event) => submitPost(event, section.id)}>
            <input required maxLength={30} placeholder="이름" value={name} onChange={(event) => setName(event.target.value)} />
            <textarea maxLength={2000} placeholder="생각이나 자료 설명을 입력하세요." value={content} onChange={(event) => setContent(event.target.value)} />
            <label className="file-picker">📎 파일 첨부 · 최대 10MB<input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
            {file && <small>{file.name}</small>}{message && <p className="form-error">{message}</p>}
            <button className="primary wide" disabled={busy}>{busy ? "게시 중…" : "게시하기"}</button>
          </form>}
          <div className="post-stack">{section.posts.map((post) => <div className="board-post" key={post.id}>
            <div className="post-author"><span>{post.authorName.slice(0,1)}</span><b>{post.authorName}</b>{manage && <button onClick={() => void manageAction({ action: "deletePost", postId: post.id })}>삭제</button>}</div>
            {post.content && <p>{post.content}</p>}
            {post.fileKey && <a className="attachment-card" href={`/api/boards/files?key=${encodeURIComponent(post.fileKey)}`} target="_blank" rel="noreferrer"><span>{post.fileType?.startsWith("image/") ? "🖼️" : "📄"}</span><div><b>{post.fileName}</b><small>{post.fileSize ? `${Math.ceil(post.fileSize/1024)}KB` : "첨부 파일"}</small></div><i>↗</i></a>}
            <small className="post-date">{new Date(post.createdAt).toLocaleString("ko-KR")}</small>
          </div>)}</div>
        </article>)}
      </section>
      <button className="floating-post" onClick={() => setComposer(data.sections[0]?.id ?? "")}>＋ 게시</button>
    </main>
  );
}
