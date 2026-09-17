import { getGitHubConfig, readSession } from "@/app/lib/github-auth";

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Erreur inattendue.";
}

function isUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function extractMetaImage(html: string): string | null {
  const tags = html.match(/<meta[^>]+>/gi) || [];
  for (const tag of tags) {
    const isImageTag = /property=["']og:image(?::secure_url)?["']/i.test(tag) || /name=["']twitter:image["']/i.test(tag);
    if (!isImageTag) continue;
    const content = tag.match(/content=["']([^"']+)["']/i)?.[1];
    if (content) return content;
  }
  return null;
}

async function fetchAndEncodeImage(imageUrl: string) {
  const response = await fetch(imageUrl, { headers: { "User-Agent": "RamcoBrochureBot/1.0 (+https://github.com/RAMCOTRV/Raminator)" } });
  if (!response.ok) throw new Error("L’image trouvée n’a pas pu être téléchargée.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  const mimeType = response.headers.get("content-type") || "image/jpeg";
  return `data:${mimeType};base64,${btoa(binary)}`;
}

export async function POST(request: Request) {
  const configured = getGitHubConfig();
  if (!configured.ok || !(await readSession(request, configured.config))) {
    return Response.json({ error: "Connectez-vous avec GitHub pour rechercher une photo." }, { status: 401 });
  }

  try {
    const payload = await request.json() as { query?: unknown };
    const query = typeof payload.query === "string" ? payload.query.trim().slice(0, 500) : "";
    if (!query) return Response.json({ error: "Indique un nom ou un lien à rechercher." }, { status: 400 });

    const botHeaders = { "User-Agent": "RamcoBrochureBot/1.0 (+https://github.com/RAMCOTRV/Raminator)" };

    // Cas 1 : un lien direct (site de l’hôtel, page Booking, Wikipédia...) — on lit sa balise og:image.
    // Gratuit, aucune clé requise : c’est juste une lecture de page.
    if (isUrl(query)) {
      const pageResponse = await fetch(query, { headers: botHeaders });
      if (!pageResponse.ok) return Response.json({ error: "Cette page n’a pas pu être ouverte." }, { status: 502 });
      const html = await pageResponse.text();
      const rawImage = extractMetaImage(html);
      if (!rawImage) return Response.json({ error: "Aucune image trouvée sur cette page." }, { status: 404 });
      const resolvedImage = new URL(rawImage, query).toString();

      return Response.json({
        imageUrl: await fetchAndEncodeImage(resolvedImage),
        placeName: query,
        source: "Lien fourni",
      });
    }

    // Cas 2 : un nom — on cherche la page Wikipédia correspondante. Gratuit, sans clé,
    // très fiable pour les excursions/monuments connus ; moins pour les petits hôtels
    // indépendants (dans ce cas, colle plutôt le lien de leur site ou de leur fiche Booking).
    const searchResponse = await fetch(
      `https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1`,
      { headers: botHeaders },
    );
    const searchResult = await searchResponse.json() as { query?: { search?: Array<{ title?: string }> } };
    const title = searchResult.query?.search?.[0]?.title;
    if (!title) {
      return Response.json({ error: "Aucune page Wikipédia trouvée pour ce nom. Essaie de coller un lien direct (site de l’hôtel, Booking...) à la place." }, { status: 404 });
    }

    const summaryResponse = await fetch(
      `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: botHeaders },
    );
    const summary = await summaryResponse.json() as {
      title?: string;
      originalimage?: { source?: string };
      thumbnail?: { source?: string };
    };
    const imageUrl = summary.originalimage?.source || summary.thumbnail?.source;
    if (!imageUrl) {
      return Response.json({ error: "Cette page Wikipédia n’a pas d’image. Essaie de coller un lien direct à la place." }, { status: 404 });
    }

    return Response.json({
      imageUrl: await fetchAndEncodeImage(imageUrl),
      placeName: summary.title || title,
      source: "Wikipédia",
    });
  } catch (error) {
    return Response.json({ error: messageFromError(error) }, { status: 500 });
  }
}
