declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ANTHROPIC_API_KEY?: string;
    OPENAI_API_KEY?: string;
    GEMINI_API_KEY?: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    GITHUB_OAUTH_REDIRECT_URI?: string;
    GITHUB_SESSION_SECRET?: string;
    GITHUB_ALLOWED_LOGIN?: string;
  }
}
import { env } from "cloudflare:workers";
import { getGitHubConfig, readSession } from "@/app/lib/github-auth";

type GeminiImageBlock = {
  type?: string;
  data?: string;
  mime_type?: string;
};

type GeminiResponse = {
  output_image?: GeminiImageBlock;
  steps?: Array<{ type?: string; content?: GeminiImageBlock[] }>;
  error?: { message?: string };
};

type OpenAIImageResponse = {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
};

type CloudflareAIResponse = {
  result?: { image?: string };
  errors?: Array<{ message?: string }>;
};

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getRetryDelay(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) {
      return Math.min(Math.max(seconds * 1000, 1000), 30_000);
    }
  }

  const fallback = 2_000 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 750);
  return Math.min(fallback + jitter, 15_000);
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Gratuit — Cloudflare Workers AI (FLUX.1 schnell).
 * Nécessite CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (un jeton "Workers AI: Read"
 * suffit, créé gratuitement depuis le dashboard Cloudflare). Inclus dans le plan
 * gratuit Workers AI (crédit mensuel de neurones).
 */
async function requestCloudflareAI(accountId: string, apiToken: string, prompt: string) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 4 }),
    },
  );

  const contentType = response.headers.get("content-type") || "";

  if (response.ok && contentType.startsWith("image/")) {
    const buffer = await response.arrayBuffer();
    return { ok: true, imageData: arrayBufferToBase64(buffer), mimeType: contentType, error: null as string | null };
  }

  const result = await readJson<CloudflareAIResponse>(response);
  if (response.ok && result.result?.image) {
    return { ok: true, imageData: result.result.image, mimeType: "image/jpeg", error: null as string | null };
  }

  const message = result.errors?.[0]?.message || `Cloudflare Workers AI a répondu avec le statut ${response.status}.`;
  return { ok: false, imageData: null as string | null, mimeType: null as string | null, error: message };
}

/**
 * Gratuit — Pollinations.ai, aucune clé API requise, aucun quota connu côté client.
 * Sert d'ultime filet gratuit avant de basculer sur les fournisseurs payants.
 */
async function requestPollinations(prompt: string) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 2000))}?width=1024&height=1024&nologo=true`;
  const response = await fetch(url);

  if (!response.ok) {
    return { ok: false, imageData: null as string | null, mimeType: null as string | null, error: `Pollinations a répondu avec le statut ${response.status}.` };
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const buffer = await response.arrayBuffer();
  return { ok: true, imageData: arrayBufferToBase64(buffer), mimeType: contentType, error: null as string | null };
}

async function requestGemini(apiKey: string, prompt: string) {
  const maxAttempts = 4;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "gemini-3.1-flash-image",
        input: [{ type: "text", text: prompt }],
        response_format: {
          type: "image",
          mime_type: "image/jpeg",
          aspect_ratio: "3:2",
          image_size: "1K",
        },
        store: false,
      }),
    });

    if (response.ok) return response;

    if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === maxAttempts - 1) {
      return response;
    }

    await sleep(getRetryDelay(response, attempt));
  }

  throw new Error("Gemini est temporairement indisponible.");
}

async function requestOpenAI(apiKey: string, prompt: string) {
  return fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      quality: "medium",
      output_format: "jpeg",
    }),
  });
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Erreur inattendue.";
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

export async function POST(request: Request) {
  const configured = getGitHubConfig();
  if (!configured.ok || !(await readSession(request, configured.config))) {
    return Response.json({ error: "Connectez-vous avec GitHub pour générer un visuel." }, { status: 401 });
  }

  const cloudflareAccountId = env.CLOUDFLARE_ACCOUNT_ID;
  const cloudflareApiToken = env.CLOUDFLARE_API_TOKEN;
  const geminiApiKey = env.GEMINI_API_KEY;
  const openaiApiKey = env.OPENAI_API_KEY;

  try {
    const payload = await request.json() as { prompt?: unknown };
    const prompt = typeof payload.prompt === "string" ? payload.prompt.trim().slice(0, 1800) : "";
    if (!prompt) return Response.json({ error: "Une description du visuel est requise." }, { status: 400 });

    // 1. Cloudflare Workers AI (gratuit, pas de clé Google/OpenAI nécessaire)
    if (cloudflareAccountId && cloudflareApiToken) {
      try {
        const result = await requestCloudflareAI(cloudflareAccountId, cloudflareApiToken, prompt);
        if (result.ok && result.imageData) {
          return Response.json({ imageData: result.imageData, mimeType: result.mimeType || "image/jpeg", provider: "cloudflare" });
        }
      } catch {
        // continue au fournisseur suivant
      }
    }

    // 2. Pollinations.ai (gratuit, sans clé API)
    try {
      const result = await requestPollinations(prompt);
      if (result.ok && result.imageData) {
        return Response.json({ imageData: result.imageData, mimeType: result.mimeType || "image/jpeg", provider: "pollinations" });
      }
    } catch {
      // continue au fournisseur suivant
    }

    // 3. OpenAI (payant, fallback)
    if (openaiApiKey) {
      try {
        const response = await requestOpenAI(openaiApiKey, prompt);
        const result = await readJson<OpenAIImageResponse>(response);
        const image = result.data?.[0]?.b64_json;

        if (response.ok && image) {
          return Response.json({ imageData: image, mimeType: "image/jpeg", provider: "openai" });
        }
      } catch {
        // continue au fournisseur suivant
      }
    }

    // 4. Gemini (payant, dernier recours)
    if (geminiApiKey) {
      const response = await requestGemini(geminiApiKey, prompt);
      const result = await readJson<GeminiResponse>(response);

      if (response.ok) {
        const image = result.output_image || result.steps
          ?.filter((step) => step.type === "model_output")
          .flatMap((step) => step.content || [])
          .find((block) => block.type === "image" && block.data);

        if (image?.data) {
          return Response.json({ imageData: image.data, mimeType: image.mime_type || "image/jpeg", provider: "gemini" });
        }
      }

      const geminiError = result.error?.message || `Gemini a répondu avec le statut ${response.status}.`;
      return Response.json({ error: geminiError }, { status: 503, headers: { "Retry-After": "10" } });
    }

    return Response.json(
      { error: "Aucun fournisseur de génération d’image n’a fonctionné. Vérifiez la configuration des clés." },
      { status: 503, headers: { "Retry-After": "10" } },
    );
  } catch (error) {
    return Response.json({ error: messageFromError(error) }, { status: 500 });
  }
}
