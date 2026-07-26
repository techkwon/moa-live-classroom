import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key?.startsWith("boards/")) return new Response("Not found", { status: 404 });
  const object = await env.UPLOADS.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=3600");
  const fileName = object.customMetadata?.fileName;
  if (fileName) headers.set("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  return new Response(object.body, { headers });
}
