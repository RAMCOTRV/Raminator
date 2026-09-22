import { env } from "cloudflare:workers";
import { getGitHubConfig, readSession } from "@/app/lib/github-auth";

type GeminiImageBlock = { type?: string; data?: string; mime_type?: string };
type GeminiResponse = { output_image?: GeminiImageBlock; steps?: Array<{ type?: string; content?: GeminiImageBlock[] }>; error?: { message?: string } };
type OpenAIImageResponse = { data?: Array<{ b64_json?: string }>; error?: { message?: string } };
type CloudflareAIResponse = { result?: { image?: string }; errors?: Array<{ message?: string }> };

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

function sleep(milliseconds: number) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

function getRetryDelay(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 1000), 30_000);
  }
  return Math.min(2_000 * 2 ** attempt + Math.floor(Math.random() * 750), 15_000);
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function readJson<T>(response: Response): Promise<T> {
  try { return await response.json() as T; } catch { return {} as T; }
}

async function requestCloudflareAI(accountId: string, apiToken: string, prompt: string) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiToken}` },
    body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 4 }),
  });
  const contentType = response.headers.get("content-type") || "";
  if (response.ok && contentType.startsWith("image/")) {
    return { ok: true, imageData: arrayBufferToBase64(await response.arrayBuffer()), mimeType: contentType };
  }
  const result = await readJson<CloudflareAIResponse>(response);
  if (response.ok && result.result?.image) return { ok: true, imageData: result.result.image, mimeType: "image/jpeg" };
  return { ok: false, imageData: null, mimeType: null, error: result.errors?.[0]?.message || `Cloudflare Workers AI a répondu avec le statut ${response.status}.` };
}

async function requestPollinations(prompt: string) {
  const response = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 2000))}?width=1024&height=1024&nologo=true`);
  if (!response.ok) return { ok: false, imageData: null, mimeType: null, error: `Pollinations a répondu avec le statut ${response.status}.` };
  return { ok: true, imageData: arrayBufferToBase64(await response.arrayBuffer()), mimeType: response.headers.get("content-type") || "image/jpeg" };
}

async function requestOpenAI(apiKey: string, prompt: string) {
  return fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", quality: "medium", output_format: "jpeg" }),
  });
}

async function requestGemini(apiKey: string, prompt: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ model: "gemini-3.1-flash-image", input: [{ type: "text", text: prompt }], response_format: { type: "image", mime_type: "image/jpeg", aspect_ratio: "3:2", image_size: "1K" }, store: false }),
    });
    if (response.ok || !RETRYABLE_STATUS_CODES.has(response.status) || attempt === 3) return response;
    await sleep(getRetryDelay(response, attempt));
  }
  throw new Error("Gemini est temporairement indisponible.");
}

export async function POST(request: Request) {
  const configured = getGitHubConfig();
  if (!configured.ok || !(await readSession(request, configured.config))) return Response.json({ error: "Connectez-vous avec GitHub pour générer un visuel." }, { status: 401 });

  try {
    const payload = await request.json() as { prompt?: unknown };
    const prompt = typeof payload.prompt === "string" ? payload.prompt.trim().slice(0, 1800) : "";
    if (!prompt) return Response.json({ error: "Une description du visuel est requise." }, { status: 400 });

    if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
      try {
        const result = await requestCloudflareAI(env.CLOUDFLARE_ACCOUNT_ID, env.CLOUDFLARE_API_TOKEN, prompt);
        if (result.ok && result.imageData) return Response.json({ imageData: result.imageData, mimeType: result.mimeType || "image/jpeg", provider: "cloudflare" });
      } catch { /* fallback */ }
    }

    try {
      const result = await requestPollinations(prompt);
      if (result.ok && result.imageData) return Response.json({ imageData: result.imageData, mimeType: result.mimeType || "image/jpeg", provider: "pollinations" });
    } catch { /* fallback */ }

    if (env.OPENAI_API_KEY) {
      try {
        const response = await requestOpenAI(env.OPENAI_API_KEY, prompt);
        const result = await readJson<OpenAIImageResponse>(response);
        if (response.ok && result.data?.[0]?.b64_json) return Response.json({ imageData: result.data[0].b64_json, mimeType: "image/jpeg", provider: "openai" });
      } catch { /* fallback */ }
    }

    if (env.GEMINI_API_KEY) {
      const response = await requestGemini(env.GEMINI_API_KEY, prompt);
      const result = await readJson<GeminiResponse>(response);
      if (response.ok) {
        const image = result.output_image || result.steps?.filter((step) => step.type === "model_output").flatMap((step) => step.content || []).find((block) => block.type === "image" && block.data);
        if (image?.data) return Response.json({ imageData: image.data, mimeType: image.mime_type || "image/jpeg", provider: "gemini" });
      }
      return Response.json({ error: "Gemini est momentanément saturé. Les autres fournisseurs n’ont pas pu générer l’image. Réessayez dans quelques instants." }, { status: 503, headers: { "Retry-After": "30" } });
    }

    return Response.json({ error: "Aucun fournisseur de génération d’image n’est configuré ou disponible." }, { status: 503, headers: { "Retry-After": "10" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erreur inattendue." }, { status: 500 });
  }
}
