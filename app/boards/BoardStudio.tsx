"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BoardSummary = { id: string; code: string; title: string; description: string; createdAt: string };

export function BoardStudio({ userName }: { userName: string }) {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [title, setTitle] = useState("우리 반 생각 보드");
  const [description, setDescription] = useState("섹션별로 자료와 의견을 함께 모아보세요.");
  const [sections, setSections] = useState(["아이디어", "자료 공유", "질문"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/boards").then(async (response) => {
      if (response.ok) setBoards(((await response.json()) as { boards: BoardSummary[] }).boards);
    });
  }, []);
  async function createBoard() {
    setBusy(true); setError("");
    const response = await fetch("/api/boards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", title, description, sections }) });
    const data = await response.json() as { id?: string; error?: string };
    if (response.ok && data.id) window.location.href = `/boards/${data.id}`;
    else setError(data.error ?? "보드를 만들지 못했습니다.");
    setBusy(false);
  }
  return (
    <main className="board-studio">
      <header className="builder-topbar">
        <Link className="brand" href="/dashboard"><span className="brand-mark">M</span><span>모아 보드</span></Link>
        <span className="session-chip">{userName} 선생님</span>
      </header>
      <div className="studio-layout">
        <section className="board-create-card glass-card">
          <p className="eyebrow">NEW BOARD</p><h1>새 보드 만들기</h1>
          <label>보드 제목<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>안내 문구<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <div className="section-setup"><div><b>섹션 구성</b><small>가로 열로 표시됩니다.</small></div>
            {sections.map((section, index) => <div className="section-input" key={index}><input value={section} onChange={(event) => setSections((items) => items.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} /><button disabled={sections.length === 1} onClick={() => setSections((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}
            <button className="add-option" onClick={() => setSections((items) => [...items, `새 섹션 ${items.length + 1}`])}>＋ 섹션 추가</button>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="primary wide" disabled={busy} onClick={createBoard}>{busy ? "만드는 중…" : "보드 만들기 →"}</button>
        </section>
        <section className="my-boards"><p className="eyebrow">MY BOARDS</p><h2>내 보드</h2>
          <div>{boards.length === 0 && <p className="empty-copy">아직 만든 보드가 없습니다.</p>}{boards.map((board) => <Link key={board.id} href={`/boards/${board.id}`}><span className="board-thumb">▦</span><div><b>{board.title}</b><small>참여 코드 {board.code}</small><p>{board.description}</p></div><i>→</i></Link>)}</div>
        </section>
      </div>
    </main>
  );
}
