"use client";

import { useState } from "react";

type ExportData = { title: string; columns: string[]; rows: Array<Array<string | number>> };

export function ExportButtons({ type, id }: { type: "session" | "board"; id: string }) {
  const [busy, setBusy] = useState("");

  async function load(): Promise<ExportData> {
    const response = await fetch(`/api/exports?type=${type}&id=${encodeURIComponent(id)}`);
    const data = await response.json() as ExportData & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "자료를 불러오지 못했습니다.");
    return data;
  }

  async function excel() {
    setBusy("excel");
    try {
      const data = await load();
      const tableRows = [data.columns, ...data.rows].map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="${typeof cell === "number" ? "Number" : "String"}">${xml(cell)}</Data></Cell>`).join("")}</Row>`).join("");
      const workbook = `<?xml version="1.0" encoding="UTF-8"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="응답 결과"><Table>${tableRows}</Table></Worksheet></Workbook>`;
      download(new Blob(["\ufeff", workbook], { type: "application/vnd.ms-excel;charset=utf-8" }), `${fileName(data.title)}_응답결과.xls`);
    } finally {
      setBusy("");
    }
  }

  async function pdf() {
    const report = window.open("", "_blank", "popup,width=1000,height=760");
    if (!report) return;
    setBusy("pdf");
    try {
      const data = await load();
      report.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${html(data.title)} 응답 결과</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif;padding:32px;color:#242124}h1{font-size:24px}p{color:#666}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #555;padding:7px;text-align:left;vertical-align:top;word-break:break-all}th{background:#eee}@page{size:A4 landscape;margin:12mm}@media print{button{display:none}}</style></head><body><h1>${html(data.title)} — 응답 결과</h1><p>총 ${data.rows.filter((row) => row.some((cell) => String(cell))).length}개 행 · ${new Date().toLocaleString("ko-KR")}</p><button onclick="window.print()">PDF로 저장 / 인쇄</button><table><thead><tr>${data.columns.map((column) => `<th>${html(column)}</th>`).join("")}</tr></thead><tbody>${data.rows.map((row) => `<tr>${row.map((cell) => `<td>${html(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table><script>setTimeout(()=>window.print(),350)<\/script></body></html>`);
      report.document.close();
    } catch (error) {
      report.document.write(`<p>${html(error instanceof Error ? error.message : "자료를 만들지 못했습니다.")}</p>`);
    } finally {
      setBusy("");
    }
  }

  return <div className="export-buttons"><button onClick={() => void excel()} disabled={Boolean(busy)}>▦ {busy === "excel" ? "준비 중…" : "Excel"}</button><button onClick={() => void pdf()} disabled={Boolean(busy)}>▤ {busy === "pdf" ? "준비 중…" : "PDF"}</button></div>;
}

function xml(value: string | number) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function html(value: string | number) {
  return xml(value).replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function fileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "모아";
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  URL.revokeObjectURL(url);
}
