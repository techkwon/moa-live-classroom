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
  assert.match(app, /모두의 생각이/);
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
