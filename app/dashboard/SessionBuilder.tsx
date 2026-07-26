"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ActivityType = "quiz" | "cloud" | "open";
type DraftActivity = { id: string; type: ActivityType; prompt: string; options: string[]; correctIndex: number };
type SavedSession = { id: string; code: string; title: string; status: string; createdAt: string; activityCount: number };

const activityMeta: Record<ActivityType, { label: string; icon: string; color: string }> = {
  quiz: { label: "퀴즈", icon: "✓", color: "mint" },
  cloud: { label: "워드클라우드", icon: "✦", color: "butter" },
  open: { label: "오픈 질문", icon: "↗", color: "lilac" },
};

function makeActivity(type: ActivityType): DraftActivity {
  return {
    id: crypto.randomUUID(),
    type,
    prompt: type === "quiz" ? "새 퀴즈 질문" : type === "cloud" ? "한 단어로 표현해 주세요" : "자유롭게 생각을 나눠 주세요",
    options: type === "quiz" ? ["선택지 1", "선택지 2", "선택지 3", "선택지 4"] : [],
    correctIndex: 0,
  };
}

export function SessionBuilder({ user, signOutPath }: { user: { displayName: string; email: string }; signOutPath: string }) {
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [title, setTitle] = useState("새 참여 수업");
  const [activities, setActivities] = useState<DraftActivity[]>([makeActivity("quiz")]);
  const [selectedId, setSelectedId] = useState(activities[0].id);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [editingSessionId, setEditingSessionId] = useState("");
  const selected = activities.find((item) => item.id === selectedId) ?? activities[0];

  useEffect(() => { void loadSessions(); }, []);

  async function loadSessions() {
    const response = await fetch("/api/creator");
    if (response.ok) {
      const data = await response.json() as { sessions: SavedSession[] };
      setSessions(data.sessions);
    }
  }

  async function loadSession(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/creator?id=${encodeURIComponent(id)}`);
      const data = await response.json() as {
        session?: { id: string; title: string };
        activities?: Array<{ id: string; type: ActivityType; prompt: string; options: string | null }>;
        error?: string;
      };
      if (!response.ok || !data.session || !data.activities) throw new Error(data.error ?? "세션을 열지 못했습니다.");
      const items = data.activities.map((item) => {
        const stored = item.options ? JSON.parse(item.options) as { choices?: string[]; correctIndex?: number } : {};
        return { id: item.id, type: item.type, prompt: item.prompt, options: stored.choices ?? [], correctIndex: stored.correctIndex ?? 0 };
      });
      setEditingSessionId(data.session.id);
      setTitle(data.session.title);
      setActivities(items);
      setSelectedId(items[0]?.id ?? "");
      setNotice("저장된 세션을 불러왔어요.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "세션을 열지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function updateSelected(patch: Partial<DraftActivity>) {
    setActivities((items) => items.map((item) => item.id === selected.id ? { ...item, ...patch } : item));
  }

  function addActivity(type: ActivityType) {
    const next = makeActivity(type);
    setActivities((items) => [...items, next]);
    setSelectedId(next.id);
  }

  function removeActivity(id: string) {
    if (activities.length === 1) return setNotice("세션에는 활동이 하나 이상 필요해요.");
    const next = activities.filter((item) => item.id !== id);
    setActivities(next);
    if (selectedId === id) setSelectedId(next[0].id);
  }

  async function saveSession(launch: boolean) {
    if (!title.trim() || activities.some((item) => !item.prompt.trim())) {
      setNotice("세션 제목과 모든 질문을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/creator", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save", sessionId: editingSessionId || undefined, title, launch, activities }),
      });
      const data = await response.json() as { code?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "저장하지 못했습니다.");
      setNotice(launch ? `라이브 세션을 열었어요 · 참여 코드 ${data.code}` : "초안으로 저장했어요.");
      await loadSessions();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="builder-shell">
      <div className="builder-bg" aria-hidden="true" />
      <header className="builder-topbar">
        <Link className="brand" href="/"><span className="brand-mark">M</span><span>모아</span></Link>
        <div className="builder-account">
          <span><b>{user.displayName}</b><small>{user.email}</small></span>
          <a href={signOutPath}>로그아웃</a>
        </div>
      </header>

      <div className="builder-layout">
        <aside className="builder-sidebar glass-card">
          <div className="sidebar-heading">
            <p className="eyebrow">MY SESSIONS</p>
            <h2>내 세션</h2>
            <button onClick={() => { setEditingSessionId(""); setTitle("새 참여 수업"); const first = makeActivity("quiz"); setActivities([first]); setSelectedId(first.id); }}>＋ 새로 만들기</button>
          </div>
          <div className="saved-list">
            {sessions.length === 0 && <p className="empty-copy">저장된 세션이 없습니다.<br />첫 수업을 만들어 보세요.</p>}
            {sessions.map((session) => (
              <article key={session.id} onClick={() => void loadSession(session.id)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") void loadSession(session.id); }}>
                <span className={`status-dot ${session.status}`} />
                <div><b>{session.title}</b><small>{session.activityCount}개 활동 · {session.status === "live" ? session.code : "초안"}</small></div>
              </article>
            ))}
          </div>
        </aside>

        <section className="builder-workspace">
          <div className="builder-title-row">
            <div>
              <p className="eyebrow">SESSION BUILDER</p>
              <input className="title-input" aria-label="세션 제목" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="builder-actions">
              <button className="secondary" disabled={busy} onClick={() => saveSession(false)}>초안 저장</button>
              <button className="primary" disabled={busy} onClick={() => saveSession(true)}>{busy ? "저장 중…" : "저장하고 시작 →"}</button>
            </div>
          </div>

          <div className="builder-canvas">
            <div className="question-stack">
              {activities.map((item, index) => (
                <button key={item.id} className={`question-card ${selectedId === item.id ? "active" : ""}`} onClick={() => setSelectedId(item.id)}>
                  <span className={`activity-icon ${activityMeta[item.type].color}`}>{activityMeta[item.type].icon}</span>
                  <span><small>0{index + 1} · {activityMeta[item.type].label}</small><b>{item.prompt}</b></span>
                  <i onClick={(event) => { event.stopPropagation(); removeActivity(item.id); }} aria-label="활동 삭제">×</i>
                </button>
              ))}
              <div className="add-menu">
                {(Object.keys(activityMeta) as ActivityType[]).map((type) => (
                  <button key={type} onClick={() => addActivity(type)}><span className={`activity-icon ${activityMeta[type].color}`}>{activityMeta[type].icon}</span>＋ {activityMeta[type].label}</button>
                ))}
              </div>
            </div>

            <div className={`question-editor ${activityMeta[selected.type].color}`}>
              <div className="editor-head"><span className={`activity-icon ${activityMeta[selected.type].color}`}>{activityMeta[selected.type].icon}</span><div><small>활동 유형</small><b>{activityMeta[selected.type].label}</b></div><span className="auto-save">● 저장 준비됨</span></div>
              <label>질문</label>
              <textarea value={selected.prompt} onChange={(event) => updateSelected({ prompt: event.target.value })} maxLength={180} />
              {selected.type === "quiz" && (
                <div className="option-editor">
                  <div className="field-label"><label>선택지</label><small>정답에 체크하세요</small></div>
                  {selected.options.map((option, index) => (
                    <div className="option-row" key={index}>
                      <button className={selected.correctIndex === index ? "correct" : ""} onClick={() => updateSelected({ correctIndex: index })}>{selected.correctIndex === index ? "✓" : String.fromCharCode(65 + index)}</button>
                      <input value={option} onChange={(event) => updateSelected({ options: selected.options.map((value, optionIndex) => optionIndex === index ? event.target.value : value) })} />
                    </div>
                  ))}
                </div>
              )}
              {selected.type === "cloud" && <div className="editor-tip">✦ 참여자는 최대 20자의 단어나 짧은 문구를 입력합니다.</div>}
              {selected.type === "open" && <div className="editor-tip">↗ 참여자는 최대 280자의 익명 답변을 작성합니다.</div>}
              <div className="editor-preview">
                <span>참여 화면 미리보기</span>
                <div><small>{activityMeta[selected.type].label}</small><h3>{selected.prompt}</h3></div>
              </div>
            </div>
          </div>
          {notice && <div className="builder-notice">{notice}</div>}
        </section>
      </div>
    </main>
  );
}
