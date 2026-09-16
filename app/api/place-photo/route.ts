import { env } from "cloudflare:workers";
import { getGitHubConfig, readSession } from "@/app/lib/github-auth";

type Place = {
  id?: string;
  displayName?: { text?: string };
  photos?: Array<{ name?: string }>;
};

type PlacesResponse = {
  places?: Place[];
  error?: { message?: string };
};

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Erreur inattendue.";
}

function getPlacesApiKey() {
  return env.GOOGLE_PLACES_API_KEY || env.GOOGLE_MAPS_API_KEY;
}

export async function POST(request: Request) {
  const configured = getGitHubConfig();
  if (!configured.ok || !(await readSession(request, configured.config))) {
    return Response.json({ error: "Connectez-vous avec GitHub pour rechercher une photo." }, { status: 401 });
  }

  const apiKey = getPlacesApiKey();
  if (!apiKey) {
    return Response.json(
      { error: "La clé GOOGLE_PLACES_API_KEY n’est pas configurée. Ajoutez-la dans les secrets du site." },
      { status: 503 },
    );
  }

  try {
    const payload = await request.json() as { query?: unknown; country?: unknown };
    const query = typeof payload.query === "string" ? payload.query.trim().slice(0, 300) : "";
    const country = typeof payload.country === "string" ? payload.country.trim().slice(0, 100) : "";
    if (!query) return Response.json({ error: "Le nom de l’hôtel ou de l’excursion est requis." }, { status: 400 });

    const textQuery = country ? `${query}, ${country}` : query;
    const searchResponse = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.photos",
      },
      body: JSON.stringify({ textQuery, languageCode: "fr", pageSize: 5 }),
    });
    const searchResult = await searchResponse.json() as PlacesResponse;
    if (!searchResponse.ok) {
      return Response.json({ error: searchResult.error?.message || "Google Places n’a pas pu rechercher ce lieu." }, { status: 502 });
    }

    const place = searchResult.places?.find((item) => item.photos?.some((photo) => photo.name)) || searchResult.places?.[0];
    const photoName = place?.photos?.find((photo) => photo.name)?.name;
    if (!photoName) {
      return Response.json({ error: "Aucune photo Google Places disponible pour ce lieu." }, { status: 404 });
    }

    const photoResponse = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&maxHeightPx=800&skipHttpRedirect=true`,
      { headers: { "X-Goog-Api-Key": apiKey } },
    );
    const photoResult = await photoResponse.json() as { photoUri?: string; error?: { message?: string } };
    if (!photoResponse.ok || !photoResult.photoUri) {
      return Response.json({ error: photoResult.error?.message || "Google Places n’a pas renvoyé la photo." }, { status: 502 });
    }

    // On télécharge l’image côté serveur et on la renvoie en base64 : ça évite tout souci de
    // CORS quand html2canvas capture la brochure pour l’export PDF (comme les visuels IA).
    const imageResponse = await fetch(photoResult.photoUri);
    if (!imageResponse.ok) {
      return Response.json({ error: "La photo Google Places n’a pas pu être téléchargée." }, { status: 502 });
    }
    const imageBytes = new Uint8Array(await imageResponse.arrayBuffer());
    let binary = "";
    imageBytes.forEach((byte) => (binary += String.fromCharCode(byte)));
    const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";

    return Response.json({
      imageUrl: `data:${mimeType};base64,${btoa(binary)}`,
      placeName: place?.displayName?.text || query,
      source: "Google Places",
    });
  } catch (error) {
    return Response.json({ error: messageFromError(error) }, { status: 500 });
  }
}
