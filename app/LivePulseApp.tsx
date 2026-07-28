"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Activity = "quiz" | "cloud" | "open";

const activityCopy: Record<Activity, { label: string; icon: string; prompt: string; color: string }> = {
  quiz: { label: "라이브 퀴즈", icon: "✓", prompt: "AI가 수업을 바꾸는 가장 큰 힘은?", color: "mint" },
  cloud: { label: "워드클라우드", icon: "✦", prompt: "오늘 수업을 한 단어로 표현해 주세요", color: "butter" },
  open: { label: "오픈 질문", icon: "↗", prompt: "내일 바로 적용해 보고 싶은 것은?", color: "lilac" },
};

const cloudWords = [
  ["참여", 1.7], ["재미", 1.3], ["소통", 1.15], ["용기", 0.95],
  ["질문", 1.05], ["몰입", 1.4], ["발견", 0.85], ["함께", 1.2],
];

export function LivePulseApp() {
  const [view, setView] = useState<"home" | "host" | "join">("home");
  const [activity, setActivity] = useState<Activity>("quiz");
  const [code, setCode] = useState("482 913");
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [participants, setParticipants] = useState(127);
  const [toast, setToast] = useState("");
  const [voted, setVoted] = useState<number[]>([]);
  const [activeId, setActiveId] = useState("");
  const [busy, setBusy] = useState(false);
  const [livePrompt, setLivePrompt] = useState("");
  const [liveOptions, setLiveOptions] = useState<string[]>([]);
  const [multiSelect, setMultiSelect] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [accepting, setAccepting] = useState(true);
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [correctIndices, setCorrectIndices] = useState<number[]>([]);
  const [openResults, setOpenResults] = useState<Array<{ id: string; answer: string; likes: number }>>([]);
  const [reaction, setReaction] = useState("");

  const copy = activityCopy[activity];
  const displayPrompt = livePrompt || copy.prompt;
  const activityIndex = useMemo(() => ["quiz", "cloud", "open"].indexOf(activity), [activity]);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function createLiveSession() {
    window.location.href = "/dashboard";
  }

  useEffect(() => {
    const joinCode = new URLSearchParams(window.location.search).get("join")?.replace(/\D/g, "");
    if (joinCode?.length !== 6) return;
    async function joinFromLink() {
      const response = await fetch(`/api/sessions?code=${joinCode}`);
      const data = await response.json() as { session?: { id: string }; active?: { id: string; type: Activity; prompt: string; options: string | null; multiSelect?: boolean; accepting: boolean; revealAnswer: boolean; correctIndices?: number[] }; results?: Array<{ id?: string; answer: string; likes?: number }>; error?: string };
      if (!response.ok || !data.active) {
        setToast(data.error ?? "현재 참여할 수 없는 세션입니다.");
        window.setTimeout(() => setToast(""), 3500);
        return;
      }
      setCode(`${joinCode!.slice(0, 3)} ${joinCode!.slice(3)}`);
      setSessionId(data.session?.id ?? "");
      setActiveId(data.active.id);
      setActivity(data.active.type);
      setLivePrompt(data.active.prompt);
      setLiveOptions(data.active.options ? JSON.parse(data.active.options) as string[] : []);
      setMultiSelect(Boolean(data.active.multiSelect));
      setAccepting(data.active.accepting);
      setRevealAnswer(data.active.revealAnswer);
      setCorrectIndices(data.active.correctIndices ?? []);
      setOpenResults((data.results ?? []).filter((item): item is { id: string; answer: string; likes: number } => Boolean(item.id)).map((item) => ({ id: item.id, answer: item.answer, likes: Number(item.likes ?? 0) })));
      setView("join");
    }
    void joinFromLink();
  }, []);

  useEffect(() => {
    if (view !== "join" || !activeId) return;
    const cleanCode = code.replace(/\D/g, "");
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/sessions?code=${cleanCode}`, { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 403) setAccepting(false);
        return;
      }
      const data = await response.json() as { active?: { id: string; type: Activity; prompt: string; options: string | null; multiSelect?: boolean; accepting: boolean; revealAnswer: boolean; correctIndices?: number[] }; results?: Array<{ id?: string; answer: string; likes?: number }> };
      if (data.active) {
        setAccepting(data.active.accepting);
        setRevealAnswer(data.active.revealAnswer);
        setCorrectIndices(data.active.correctIndices ?? []);
        setOpenResults((data.results ?? []).filter((item): item is { id: string; answer: string; likes: number } => Boolean(item.id)).map((item) => ({ id: item.id, answer: item.answer, likes: Number(item.likes ?? 0) })));
      }
      if (data.active && data.active.id !== activeId) {
        setActiveId(data.active.id);
        setActivity(data.active.type);
        setLivePrompt(data.active.prompt);
        setLiveOptions(data.active.options ? JSON.parse(data.active.options) as string[] : []);
        setMultiSelect(Boolean(data.active.multiSelect));
        setSubmitted(false);
        setAnswer("");
        setVoted([]);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [view, activeId, code]);

  async function enterCode(cleanCode: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/sessions?code=${cleanCode}`);
      const data = await response.json() as { session?: { id: string }; active?: { id: string; type: Activity; prompt: string; options: string | null; multiSelect?: boolean; accepting: boolean; revealAnswer: boolean; correctIndices?: number[] }; results?: Array<{ id?: string; answer: string; likes?: number }>; error?: string };
      if (!response.ok || !data.active) {
        const boardResponse = await fetch(`/api/boards?code=${cleanCode}`);
        if (boardResponse.ok) {
          window.location.href = `/board/${cleanCode}`;
          return;
        }
        throw new Error(data.error ?? "세션을 찾을 수 없습니다.");
      }
      setActiveId(data.active.id);
      setSessionId(data.session?.id ?? "");
      setActivity(data.active.type);
      setLivePrompt(data.active.prompt);
      setLiveOptions(data.active.options ? JSON.parse(data.active.options) as string[] : []);
      setMultiSelect(Boolean(data.active.multiSelect));
      setAccepting(data.active.accepting);
      setRevealAnswer(data.active.revealAnswer);
      setCorrectIndices(data.active.correctIndices ?? []);
      setOpenResults((data.results ?? []).filter((item): item is { id: string; answer: string; likes: number } => Boolean(item.id)).map((item) => ({ id: item.id, answer: item.answer, likes: Number(item.likes ?? 0) })));
      setVoted([]);
      setView("join");
    } catch {
      flash("참여 코드를 다시 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function submitJoin(event: FormEvent) {
    event.preventDefault();
    const cleanCode = code.replace(/\D/g, "");
    if (cleanCode.length < 6) {
      flash("6자리 참여 코드를 입력해 주세요.");
      return;
    }
    await enterCode(cleanCode);
  }

  async function sendResponse(value: string) {
    if (activeId) {
      const participantId = localStorage.getItem("moa-participant") ?? crypto.randomUUID();
      localStorage.setItem("moa-participant", participantId);
      const response = await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "respond", activityId: activeId, participantId, answer: value }) });
      if (!response.ok) throw new Error("응답 전송 실패");
    }
  }

  function participantId() {
    const stored = localStorage.getItem("moa-participant") ?? crypto.randomUUID();
    localStorage.setItem("moa-participant", stored);
    return stored;
  }

  async function sendReaction(emoji: string) {
    if (!sessionId) return;
    await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "react", sessionId, participantId: participantId(), emoji }) });
    setReaction(emoji);
  }

  async function toggleLike(responseId: string) {
    const response = await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "like", responseId, participantId: participantId() }) });
    if (response.ok) {
      const data = await response.json() as { liked: boolean };
      setOpenResults((items) => items.map((item) => item.id === responseId ? { ...item, likes: Math.max(0, item.likes + (data.liked ? 1 : -1)) } : item));
    }
  }

  async function submitText(event: FormEvent) {
    event.preventDefault();
    if (!answer.trim()) return flash("답변을 먼저 입력해 주세요.");
    setBusy(true);
    try {
      await sendResponse(answer.trim());
      setSubmitted(true);
      setParticipants((current) => current + 1);
    } catch {
      flash("응답을 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (view === "host") {
    return (
      <main className="app-shell host-shell">
        <Decorations />
        <header className="topbar">
          <button className="brand" onClick={() => setView("home")} aria-label="모아 홈">
            <span className="brand-mark">M</span><span>모아</span>
          </button>
          <div className="session-chip"><span className="live-dot" /> 라이브 · {code}</div>
          <button className="avatar" aria-label="내 계정">김</button>
        </header>

        <div className="host-layout">
          <aside className="activity-rail glass-card">
            <p className="eyebrow">내 세션</p>
            <h2>AI로 여는<br />참여 수업</h2>
            <div className="activity-list">
              {(Object.keys(activityCopy) as Activity[]).map((key, index) => (
                <button
                  key={key}
                  className={`activity-item ${activity === key ? "active" : ""}`}
                  onClick={() => { setActivity(key); setVoted([]); setSubmitted(false); }}
                >
                  <span className={`activity-icon ${activityCopy[key].color}`}>{activityCopy[key].icon}</span>
                  <span><b>{activityCopy[key].label}</b><small>{index + 1} / 3</small></span>
                </button>
              ))}
            </div>
            <button className="add-activity" onClick={() => flash("새 활동 템플릿을 준비했어요.")}>＋ 활동 추가</button>
          </aside>

          <section className="stage">
            <div className="stage-toolbar">
              <div>
                <span className="tiny-label">지금 진행 중</span>
                <strong>{copy.label}</strong>
              </div>
              <div className="toolbar-actions">
                <button className="icon-button" onClick={() => flash("응답을 잠시 멈췄어요.")}>Ⅱ</button>
                <button className="primary compact" onClick={() => flash("결과 화면 링크를 복사했어요.")}>결과 공유 ↗</button>
              </div>
            </div>

            <div className={`presentation-card ${copy.color}`}>
              <div className="question-count">0{activityIndex + 1}</div>
              <p className="question-type">{copy.icon} {copy.label}</p>
              <h1>{copy.prompt}</h1>
              {activity === "quiz" && (
                <div className="results-bars">
                  {[
                    ["빠른 정답 찾기", 22, "pink"],
                    ["모두의 생각 연결하기", 68, "purple"],
                    ["숙제 자동 채점", 7, "yellow"],
                    ["교사를 대신하기", 3, "blue"],
                  ].map(([label, value, color]) => (
                    <div className="result-row" key={String(label)}>
                      <span>{label}</span>
                      <div className="bar-track"><i className={String(color)} style={{ width: `${value}%` }} /></div>
                      <b>{value}%</b>
                    </div>
                  ))}
                </div>
              )}
              {activity === "cloud" && (
                <div className="word-cloud">
                  {cloudWords.map(([word, scale], index) => (
                    <span key={String(word)} style={{ fontSize: `${Number(scale) * 2}rem`, transform: `rotate(${index % 3 === 0 ? -3 : index % 3 === 1 ? 2 : 0}deg)` }}>{word}</span>
                  ))}
                </div>
              )}
              {activity === "open" && (
                <div className="response-grid">
                  {["학생이 직접 질문을 만드는 퀴즈", "익명으로 수업 마무리 소감 받기", "우리 반 핵심어 워드클라우드", "모둠별 아이디어 투표하기"].map((text, index) => (
                    <article key={text}><span>0{index + 1}</span><p>{text}</p><button aria-label="좋아요">♡ {index + 2}</button></article>
                  ))}
                </div>
              )}
              <div className="audience-pill"><span>●</span> {participants}명 참여 중</div>
            </div>

            <div className="host-footer glass-card">
              <span>참여 코드</span><strong>{code}</strong><span className="divider" />
              <span>moa.live</span><button onClick={() => flash("참여 링크를 복사했어요.")}>링크 복사</button>
            </div>
          </section>
        </div>
        {toast && <div className="toast">{toast}</div>}
      </main>
    );
  }

  if (view === "join") {
    const quizOptions = liveOptions.length ? liveOptions : ["빠른 정답 찾기", "모두의 생각 연결하기", "숙제 자동 채점", "교사를 대신하기"];
    return (
      <main className="app-shell participant-shell">
        <Decorations />
        <header className="topbar">
          <button className="brand" onClick={() => setView("home")}><span className="brand-mark">M</span><span>모아</span></button>
          <div className="session-chip">세션 {code}</div>
        </header>
        <section className="phone-stage">
          <div className={`participant-card glass-card ${submitted ? "success-card" : ""}`}>
            {submitted ? (
              <>
                <div className="success-burst">✓</div>
                <p className="eyebrow">응답 완료</p>
                <h1>생각을 보태 주셔서<br />고마워요!</h1>
                <p className="muted">진행자가 다음 질문을 준비하고 있어요.</p>
                {activity === "quiz" && revealAnswer && correctIndices.length > 0 && <div className="answer-reveal">정답: {correctIndices.map((index) => liveOptions[index]).filter(Boolean).join(", ")}</div>}
                <div className="emotion-preset"><span>기다리는 동안 지금 기분은?</span><div>{["😊","🤔","😮","👏","❤️"].map((emoji) => <button className={reaction === emoji ? "active" : ""} key={emoji} onClick={() => void sendReaction(emoji)}>{emoji}</button>)}</div></div>
                {activity === "open" && openResults.length > 0 && <div className="participant-ideas">{openResults.map((item) => <article key={item.id}><p>{item.answer}</p><button onClick={() => void toggleLike(item.id)}>♥ {item.likes}</button></article>)}</div>}
                <button className="secondary wide" onClick={() => { setSubmitted(false); setAnswer(""); setVoted([]); }}>다른 활동 체험하기</button>
              </>
            ) : (
              <>
                <div className="participant-meta"><span className={`activity-icon ${copy.color}`}>{copy.icon}</span><span>{copy.label}</span><b>{participants}명 참여 중</b></div>
                <h1>{displayPrompt}</h1>
                {activity === "quiz" ? (
                  <div className="quiz-options">
                    {quizOptions.map((option, index) => <button key={option} className={voted.includes(index) ? "selected" : ""} onClick={() => setVoted((current) => multiSelect ? (current.includes(index) ? current.filter((value) => value !== index) : [...current, index]) : [index])}><span>{voted.includes(index) ? "✓" : String.fromCharCode(65 + index)}</span>{option}</button>)}
                    {multiSelect && <p className="participant-hint">복수 정답 문항입니다. 여러 개를 선택하세요.</p>}
                    <button className="primary wide" disabled={!accepting || voted.length === 0 || busy} onClick={async () => {
                      if (voted.length === 0) return;
                      setBusy(true);
                      try {
                        await sendResponse(voted.sort((a, b) => a - b).map((index) => quizOptions[index]).join("|||"));
                        setSubmitted(true);
                        setParticipants((n) => n + 1);
                      } catch {
                        flash("응답을 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
                      } finally {
                        setBusy(false);
                      }
                    }}>{!accepting ? "응답이 마감되었습니다" : busy ? "전송 중…" : "답변 보내기"}</button>
                  </div>
                ) : (
                  <form onSubmit={submitText}>
                    <textarea maxLength={activity === "cloud" ? 20 : 280} placeholder={activity === "cloud" ? "예: 몰입" : "자유롭게 생각을 적어 주세요."} value={answer} onChange={(e) => setAnswer(e.target.value)} />
                    <div className="field-note"><span>익명으로 공유돼요</span><span>{answer.length} / {activity === "cloud" ? 20 : 280}</span></div>
                    <button className="primary wide" disabled={!accepting || busy}>{!accepting ? "응답이 마감되었습니다" : busy ? "전송 중…" : "답변 보내기"}</button>
                  </form>
                )}
                <div className="switch-activity">
                  {(Object.keys(activityCopy) as Activity[]).map((key) => <button key={key} className={activity === key ? "active" : ""} onClick={() => { setActivity(key); setVoted([]); setAnswer(""); }}>{activityCopy[key].icon}</button>)}
                </div>
              </>
            )}
          </div>
        </section>
        {toast && <div className="toast">{toast}</div>}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Decorations />
      <header className="topbar">
        <button className="brand"><span className="brand-mark">M</span><span>모아</span></button>
        <nav><a href="#features">주요 기능</a><a href="#join">코드로 참여</a></nav>
          <button className="secondary" onClick={createLiveSession}>로그인 · 시작하기</button>
      </header>
      <div className="landing-update"><b>NEW</b><span>섹션 보드 · 파일 공유 · QR 참여 · 결과 다운로드</span></div>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow-badge">교사를 위한 실시간 참여 수업 도구</div>
          <h1>질문하고,<br /><span>모으고, 함께 봐요</span></h1>
          <p>퀴즈부터 생각 보드까지 한 링크로.<br />조용한 학생의 의견도 수업의 중심으로 가져오세요.</p>
          <div className="hero-actions">
            <button className="primary" onClick={createLiveSession}>세션 만들기 <span>→</span></button>
            <a className="text-button" href="#join">참여 코드 입력 <span>↓</span></a>
          </div>
          <div className="trust-row"><span className="avatar-stack">Q<span>☁</span><span>▦</span></span><b>퀴즈 · 워드클라우드 · 생각 보드</b></div>
        </div>

        <div className="hero-demo">
          <div className="demo-backdrop" />
          <div className="demo-window glass-card">
            <div className="window-top"><div className="window-dots"><i /><i /><i /></div><span>LIVE SESSION</span><b>127명 참여 중</b></div>
            <div className="demo-content">
              <div className="demo-side"><span className="mini-logo">M</span><i className="active" /><i /><i /><i /></div>
              <div className="demo-main landing-board-demo">
                <p>CLASS BOARD · LIVE</p>
                <h3>우리 반의 생각이<br />주제별로 차곡차곡</h3>
                <div className="mini-board-columns"><article><b>아이디어</b><span>새로운 질문 만들기</span><span>친구 의견 연결하기</span></article><article><b>자료 공유</b><span>📎 활동지.pdf</span></article><article><b>질문</b><span>왜 그런가요?</span></article></div>
              </div>
            </div>
          </div>
          <div className="floating-card float-quiz"><span>▦</span><div><b>생각 보드</b><small>QR로 바로 참여</small></div></div>
          <div className="floating-card float-reaction">👏 <b>+24</b></div>
          <div className="code-sticker">JOIN<br /><b>482 913</b></div>
        </div>
      </section>

      <section className="join-strip glass-card" id="join">
        <div><span className="pulse-icon">◉</span><p><b>이미 세션이 진행 중인가요?</b><small>진행자에게 받은 6자리 코드를 입력하세요.</small></p></div>
        <form onSubmit={submitJoin}><input inputMode="numeric" aria-label="참여 코드" value={code} onChange={(e) => setCode(e.target.value)} /><button className="primary">참여하기 →</button></form>
      </section>

      <section className="feature-section" id="features">
        <p className="eyebrow">하나의 세션, 무한한 참여</p>
        <h2>수업의 흐름은 단순하게,<br />참여 방식은 풍성하게</h2>
        <div className="feature-grid">
          {(Object.keys(activityCopy) as Activity[]).map((key, index) => (
            <article className={`feature-card ${activityCopy[key].color}`} key={key}>
              <div className="feature-number">0{index + 1}</div>
              <span className="big-icon">{activityCopy[key].icon}</span>
              <h3>{activityCopy[key].label}</h3>
              <p>{key === "quiz" ? "정답과 속도를 함께 확인하고 수업의 에너지를 끌어올려요." : key === "cloud" ? "모두의 단어가 실시간으로 자라며 교실의 생각 지도를 만들어요." : "익명 답변과 공감 투표로 조용한 학생의 목소리도 놓치지 않아요."}</p>
              <button onClick={() => { setActivity(key); setView("join"); }}>체험하기 ↗</button>
            </article>
          ))}
          <article className="feature-card board-feature">
            <div className="feature-number">04</div>
            <span className="big-icon">▦</span>
            <h3>섹션 보드</h3>
            <p>주제별 게시판에 의견과 파일을 모으고 QR로 바로 초대해요.</p>
            <button onClick={createLiveSession}>보드 만들기 ↗</button>
          </article>
        </div>
      </section>
      <footer><div className="brand"><span className="brand-mark">M</span><span>모아</span></div><p>모두의 생각을 모으는 가장 따뜻한 방법.</p><span>© 2026 MOA LAB</span></footer>
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function Decorations() {
  return <div className="decorations" aria-hidden="true"><i className="blob blob-one" /><i className="blob blob-two" /><i className="blob blob-three" /><i className="grid-dots" /></div>;
}
