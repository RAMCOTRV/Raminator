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

  const geminiApiKey = env.GEMINI_API_KEY;
  const openaiApiKey = env.OPENAI_API_KEY;

  if (!geminiApiKey && !openaiApiKey) {
    return Response.json(
      { error: "Configurez GEMINI_API_KEY ou OPENAI_API_KEY pour générer un visuel." },
      { status: 503 },
    );
  }

  try {
    const payload = await request.json() as { prompt?: unknown };
    const prompt = typeof payload.prompt === "string" ? payload.prompt.trim().slice(0, 1800) : "";
    if (!prompt) return Response.json({ error: "Une description du visuel est requise." }, { status: 400 });

    if (geminiApiKey) {
      try {
        const response = await requestGemini(geminiApiKey, prompt);
        const result = await readJson<GeminiResponse>(response);

        if (response.ok) {
          const image = result.output_image || result.steps
            ?.filter((step) => step.type === "model_output")
            .flatMap((step) => step.content || [])
            .find((block) => block.type === "image" && block.data);

          if (image?.data) {
            return Response.json({
              imageData: image.data,
              mimeType: image.mime_type || "image/jpeg",
              provider: "gemini",
            });
          }
        }
      } catch {
        // continue to backup provider below
      }
    }

    if (openaiApiKey) {
      const response = await requestOpenAI(openaiApiKey, prompt);
      const result = await readJson<OpenAIImageResponse>(response);
      const image = result.data?.[0]?.b64_json;

      if (response.ok && image) {
        return Response.json({ imageData: image, mimeType: "image/jpeg", provider: "openai" });
      }

      const openaiError = result.error?.message || `OpenAI a répondu avec le statut ${response.status}.`;
      return Response.json(
        { error: openaiError },
        { status: 503, headers: { "Retry-After": "10" } },
      );
    }

    return Response.json(
      { error: "Le service de génération d’image est temporairement indisponible." },
      { status: 503, headers: { "Retry-After": "10" } },
    );
  } catch (error) {
    return Response.json({ error: messageFromError(error) }, { status: 500 });
  }
}
