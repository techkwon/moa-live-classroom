"use client";

import { FormEvent, useMemo, useState } from "react";

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
  const [voted, setVoted] = useState<number | null>(null);
  const [activeId, setActiveId] = useState("");
  const [busy, setBusy] = useState(false);

  const copy = activityCopy[activity];
  const activityIndex = useMemo(() => ["quiz", "cloud", "open"].indexOf(activity), [activity]);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function createLiveSession() {
    window.location.href = "/dashboard";
  }

  async function submitJoin(event: FormEvent) {
    event.preventDefault();
    const cleanCode = code.replace(/\D/g, "");
    if (cleanCode.length < 6) {
      flash("6자리 참여 코드를 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/sessions?code=${cleanCode}`);
      const data = await response.json() as { active?: { id: string; type: Activity }; error?: string };
      if (!response.ok || !data.active) throw new Error(data.error ?? "세션을 찾을 수 없습니다.");
      setActiveId(data.active.id);
      setActivity(data.active.type);
      setView("join");
    } catch {
      flash("체험용 세션으로 입장합니다.");
      setView("join");
    } finally {
      setBusy(false);
    }
  }

  async function sendResponse(value: string) {
    if (activeId) {
      const participantId = localStorage.getItem("moa-participant") ?? crypto.randomUUID();
      localStorage.setItem("moa-participant", participantId);
      const response = await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "respond", activityId: activeId, participantId, answer: value }) });
      if (!response.ok) throw new Error("응답 전송 실패");
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
                  onClick={() => { setActivity(key); setVoted(null); setSubmitted(false); }}
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
    const quizOptions = ["빠른 정답 찾기", "모두의 생각 연결하기", "숙제 자동 채점", "교사를 대신하기"];
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
                <button className="secondary wide" onClick={() => { setSubmitted(false); setAnswer(""); setVoted(null); }}>다른 활동 체험하기</button>
              </>
            ) : (
              <>
                <div className="participant-meta"><span className={`activity-icon ${copy.color}`}>{copy.icon}</span><span>{copy.label}</span><b>{participants}명 참여 중</b></div>
                <h1>{copy.prompt}</h1>
                {activity === "quiz" ? (
                  <div className="quiz-options">
                    {quizOptions.map((option, index) => <button key={option} className={voted === index ? "selected" : ""} onClick={() => setVoted(index)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}
                    <button className="primary wide" disabled={voted === null || busy} onClick={async () => {
                      if (voted === null) return;
                      setBusy(true);
                      try {
                        await sendResponse(quizOptions[voted]);
                        setSubmitted(true);
                        setParticipants((n) => n + 1);
                      } catch {
                        flash("응답을 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
                      } finally {
                        setBusy(false);
                      }
                    }}>{busy ? "전송 중…" : "답변 보내기"}</button>
                  </div>
                ) : (
                  <form onSubmit={submitText}>
                    <textarea maxLength={activity === "cloud" ? 20 : 280} placeholder={activity === "cloud" ? "예: 몰입" : "자유롭게 생각을 적어 주세요."} value={answer} onChange={(e) => setAnswer(e.target.value)} />
                    <div className="field-note"><span>익명으로 공유돼요</span><span>{answer.length} / {activity === "cloud" ? 20 : 280}</span></div>
                    <button className="primary wide" disabled={busy}>{busy ? "전송 중…" : "답변 보내기"}</button>
                  </form>
                )}
                <div className="switch-activity">
                  {(Object.keys(activityCopy) as Activity[]).map((key) => <button key={key} className={activity === key ? "active" : ""} onClick={() => { setActivity(key); setVoted(null); setAnswer(""); }}>{activityCopy[key].icon}</button>)}
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
        <nav><a href="#features">기능</a><a href="#how">활용 방법</a><a href="#teachers">교육용</a></nav>
          <button className="secondary" onClick={createLiveSession}>로그인 · 시작하기</button>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow-badge">✦ 생각이 모이면, 수업이 움직여요</div>
          <h1>모두의 생각이<br /><span>보이는 순간</span></h1>
          <p>퀴즈, 워드클라우드, 열린 질문으로<br />200명의 목소리를 한 화면에 모아보세요.</p>
          <div className="hero-actions">
            <button className="primary" onClick={createLiveSession}>세션 만들기 <span>→</span></button>
            <button className="text-button" onClick={() => setView("join")}>참여 화면 미리보기 <span>↗</span></button>
          </div>
          <div className="trust-row"><span className="avatar-stack">김<span>이</span><span>박</span></span><b>선생님과 진행자 12,000명이 함께해요</b></div>
        </div>

        <div className="hero-demo">
          <div className="demo-backdrop" />
          <div className="demo-window glass-card">
            <div className="window-top"><div className="window-dots"><i /><i /><i /></div><span>LIVE SESSION</span><b>127명 참여 중</b></div>
            <div className="demo-content">
              <div className="demo-side"><span className="mini-logo">M</span><i className="active" /><i /><i /><i /></div>
              <div className="demo-main">
                <p>WORD CLOUD · 02</p>
                <h3>오늘 수업을 한 단어로<br />표현해 주세요</h3>
                <div className="mini-cloud">{cloudWords.slice(0, 6).map(([word, scale]) => <span key={String(word)} style={{ fontSize: `${Number(scale) * 1.25}rem` }}>{word}</span>)}</div>
              </div>
            </div>
          </div>
          <div className="floating-card float-quiz"><span>✓</span><div><b>라이브 퀴즈</b><small>정답률 86%</small></div></div>
          <div className="floating-card float-reaction">👏 <b>+24</b></div>
          <div className="code-sticker">JOIN<br /><b>482 913</b></div>
        </div>
      </section>

      <section className="join-strip glass-card">
        <div><span className="pulse-icon">◉</span><p><b>이미 세션이 진행 중인가요?</b><small>진행자에게 받은 6자리 코드를 입력하세요.</small></p></div>
        <form onSubmit={submitJoin}><input inputMode="numeric" aria-label="참여 코드" value={code} onChange={(e) => setCode(e.target.value)} /><button className="primary">참여하기 →</button></form>
      </section>

      <section className="feature-section" id="features">
        <p className="eyebrow">하나의 세션, 무한한 참여</p>
        <h2>말하지 않아도<br />모두가 참여하는 수업</h2>
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
