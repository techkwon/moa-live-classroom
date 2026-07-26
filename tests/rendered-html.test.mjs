import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("defines the finished Korean participation app", async () => {
  const [page, layout, app] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/LivePulseApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /LivePulseApp/);
  assert.match(layout, /<html lang="ko">/);
  assert.match(layout, /모아/);
  assert.match(app, /질문하고/);
  assert.match(app, /로그인 · 시작하기/);
  assert.match(app, /세션 만들기/);
  assert.match(app, /참여하기/);
  assert.doesNotMatch(`${page}${layout}${app}`, /codex-preview|react-loading-skeleton|Starter Project/);
});

test("gates session authoring behind ChatGPT sign-in and owner checks", async () => {
  const [dashboard, builder, creator, presenter, schema] = await Promise.all([
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/SessionBuilder.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/creator/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/present/[id]/Presenter.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /requireChatGPTUser\("\/dashboard"\)/);
  assert.match(creator, /getChatGPTUser/);
  assert.match(creator, /sessions\.ownerEmail/);
  assert.match(creator, /status: 401/);
  assert.match(schema, /ownerEmail/);
  assert.match(builder, /초안 저장/);
  assert.match(builder, /저장하고 시작/);
  assert.match(builder, /퀴즈/);
  assert.match(builder, /워드클라우드/);
  assert.match(builder, /오픈 질문/);
  assert.match(builder, /correctIndices/);
  assert.match(builder, /선택지 추가/);
  assert.match(builder, /window\.location\.href = `\/present\//);
  assert.match(presenter, /create-qr-code/);
  assert.match(presenter, /참여 링크 복사/);
  assert.match(presenter, /2초마다 자동 집계/);
  assert.match(presenter, /참여 정보 숨기기/);
  assert.match(presenter, /focus-results/);
  assert.match(presenter, /참여 정보 보기/);
  assert.match(presenter, /응답 마감/);
  assert.match(presenter, /정답 공개/);
  assert.match(builder, /정답 없이 의견만 집계/);
  assert.match(builder, /워드클라우드 모양/);
});

test("persists participant reactions and open-response likes", async () => {
  const [schema, sessionsApi, participant] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/sessions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/LivePulseApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /responseLikes/);
  assert.match(schema, /sessionReactions/);
  assert.match(schema, /revealAnswer/);
  assert.match(sessionsApi, /action === "react"/);
  assert.match(sessionsApi, /action === "like"/);
  assert.match(participant, /기다리는 동안 지금 기분은/);
  assert.match(participant, /toggleLike/);
});

test("ships the three requested activity types and durable storage declaration", async () => {
  const [app, schema, hosting, packageJson] = await Promise.all([
    readFile(new URL("../app/LivePulseApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(app, /라이브 퀴즈/);
  assert.match(app, /워드클라우드/);
  assert.match(app, /오픈 질문/);
  assert.match(schema, /sessions/);
  assert.match(schema, /activities/);
  assert.match(schema, /responses/);
  assert.equal(JSON.parse(hosting).d1, "DB");
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("locks responses to the presented question and provides section boards with uploads", async () => {
  const [sessionsApi, boardsApi, boardCanvas, studio, schema, hosting] = await Promise.all([
    readFile(new URL("../app/api/sessions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/boards/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/board/[code]/BoardCanvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/boards/BoardStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);
  assert.match(sessionsApi, /현재 진행 중인 문항에만 응답하거나 수정할 수 있습니다/);
  assert.match(sessionsApi, /activities\.isActive/);
  assert.match(schema, /boardSections/);
  assert.match(schema, /boardPosts/);
  assert.match(boardsApi, /10 \* 1024 \* 1024/);
  assert.match(boardsApi, /env\.UPLOADS\.put/);
  assert.match(studio, /섹션 구성/);
  assert.match(boardCanvas, /파일 첨부/);
  assert.match(boardCanvas, /교사 관리/);
  assert.equal(JSON.parse(hosting).r2, "UPLOADS");
});

test("offers board themes, QR participation links, and honest landing copy", async () => {
  const [app, boardCanvas, boardsApi, schema] = await Promise.all([
    readFile(new URL("../app/LivePulseApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/board/[code]/BoardCanvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/boards/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /theme: text\("theme"\)/);
  assert.match(boardsApi, /action === "setTheme"/);
  assert.match(boardCanvas, /QR 크게 보기/);
  assert.match(boardCanvas, /create-qr-code/);
  assert.match(boardCanvas, /boardThemes/);
  assert.match(app, /섹션 보드/);
  assert.doesNotMatch(app, /12,000명/);
});

test("exports owned session and board responses and keeps board joining visible", async () => {
  const [exportsApi, exportButtons, boardCanvas, presenter, app] = await Promise.all([
    readFile(new URL("../app/api/exports/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ExportButtons.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/board/[code]/BoardCanvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/present/[id]/Presenter.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/LivePulseApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(exportsApi, /sessions\.ownerEmail/);
  assert.match(exportsApi, /boards\.ownerEmail/);
  assert.match(exportsApi, /responses\.answer/);
  assert.match(exportsApi, /boardPosts\.content/);
  assert.match(exportButtons, /application\/vnd\.ms-excel/);
  assert.match(exportButtons, /PDF로 저장/);
  assert.match(boardCanvas, /board-share-panel/);
  assert.match(boardCanvas, /보드 참여 링크/);
  assert.match(presenter, /type="session"/);
  assert.match(app, /결과 다운로드/);
});
