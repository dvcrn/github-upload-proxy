export interface Env {
  API_KEY: string;
  GITHUB_UPLOAD_TOKEN: string;
  MAX_BYTES?: string;
}

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024; // 25 MiB
const ALLOWED_CONTENT_TYPES = /^(image\/(png|jpeg|gif|webp)|video\/(mp4|quicktime))$/;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }

    const authHeader = req.headers.get("authorization") ?? "";
    const apiKeyHeader = req.headers.get("x-api-key") ?? "";
    const providedKey = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader || apiKeyHeader;

    if (!env.API_KEY || providedKey !== env.API_KEY) {
      return new Response("unauthorized", { status: 401 });
    }

    let payload: {
      repo_id: number | string;
      name: string;
      content_type: string;
      data: string;
    };
    try {
      payload = await req.json();
    } catch {
      return new Response("invalid json", { status: 400 });
    }

    const { repo_id, name, content_type, data } = payload;
    if (!repo_id || !name || !content_type || typeof data !== "string") {
      return new Response("missing required fields (repo_id, name, content_type, data)", {
        status: 400,
      });
    }

    if (!ALLOWED_CONTENT_TYPES.test(content_type)) {
      return new Response("type not allowed", { status: 415 });
    }

    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    } catch {
      return new Response("invalid base64 data", { status: 400 });
    }

    const maxBytes = env.MAX_BYTES ? Number(env.MAX_BYTES) : DEFAULT_MAX_BYTES;
    if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) {
      return new Response("file size not allowed", { status: 413 });
    }

    const url = new URL("https://uploads.github.com/user-attachments/assets");
    url.search = new URLSearchParams({
      name,
      content_type,
      repository_id: String(repo_id),
    }).toString();

    const gh = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.GITHUB_UPLOAD_TOKEN}`,
        accept: "application/vnd.github+json",
        "content-type": "application/octet-stream",
        "user-agent": "upload-proxy",
      },
      body: bytes,
    });

    return new Response(gh.body, {
      status: gh.status,
      headers: { "content-type": "application/json" },
    });
  },
};
