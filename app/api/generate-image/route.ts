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

    if (response.ok) {
      return response;
    }

    if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === maxAttempts - 1) {
      return response;
    }

    await sleep(getRetryDelay(response, attempt));
  }

  throw new Error("Gemini est temporairement indisponible.");
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Erreur inattendue.";
}

export async function POST(request: Request) {
  const configured = getGitHubConfig();
  if (!configured.ok || !(await readSession(request, configured.config))) {
    return Response.json({ error: "Connectez-vous avec GitHub pour générer un visuel." }, { status: 401 });
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "La clé Gemini n’est pas encore configurée pour ce site." }, { status: 503 });
  }

  try {
    const payload = await request.json() as { prompt?: unknown };
    const prompt = typeof payload.prompt === "string" ? payload.prompt.trim().slice(0, 1800) : "";
    if (!prompt) return Response.json({ error: "Une description du visuel est requise." }, { status: 400 });

    const response = await requestGemini(apiKey, prompt);
    const result = await response.json() as GeminiResponse;
    if (!response.ok) {
      const errorMessage = result.error?.message || "Gemini est momentanément saturé. Réessayez dans quelques secondes.";
      return Response.json(
        { error: errorMessage },
        {
          status: response.status === 429 || response.status === 503 ? 503 : 502,
          headers: { "Retry-After": "10" },
        },
      );
    }

    const image = result.output_image || result.steps
      ?.filter((step) => step.type === "model_output")
      .flatMap((step) => step.content || [])
      .find((block) => block.type === "image" && block.data);
    if (!image?.data) return Response.json({ error: "Gemini a répondu sans image exploitable." }, { status: 502 });

    return Response.json({ imageData: image.data, mimeType: image.mime_type || "image/jpeg" });
  } catch (error) {
    return Response.json({ error: messageFromError(error) }, { status: 500 });
  }
}
