import { env } from "cloudflare:workers";
import { getGitHubConfig, readSession } from "@/app/lib/github-auth";

type Place = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
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

function buildPlaceSearchQueries(query: string, country: string) {
  const base = query.trim();
  const variants = new Set<string>();

  if (!base) return [];

  variants.add(base);
  variants.add(`${base}, ${country}`.trim());
  variants.add(`${base} ${country}`.trim());
  variants.add(`${base} hotel`);
  variants.add(`${base} resort`);
  variants.add(`${base} excursion`);
  variants.add(`${base} attraction`);
  variants.add(`${base} ${country} hotel`);
  variants.add(`${base} ${country} excursion`);

  return Array.from(variants).filter(Boolean).slice(0, 8);
}

async function findBestPlace(apiKey: string, query: string, country: string) {
  const queries = buildPlaceSearchQueries(query, country);

  for (const textQuery of queries) {
    const searchResponse = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.photos",
      },
      body: JSON.stringify({ textQuery, languageCode: "fr", pageSize: 5 }),
    });

    if (!searchResponse.ok) continue;

    const searchResult = await searchResponse.json() as PlacesResponse;
    const place = searchResult.places?.find((item) => item.photos?.some((photo) => photo.name)) || searchResult.places?.[0];
    if (place) return place;
  }

  return undefined;
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

    const place = await findBestPlace(apiKey, query, country);

    if (!place) {
      return Response.json(
        {
          error: `Aucune photo Google Places disponible pour "${query}". Vérifiez le nom exact du lieu ou ajoutez la ville/pays.`,
        },
        { status: 404 },
      );
    }

    const photoName = place.photos?.find((photo) => photo.name)?.name;
    if (!photoName) {
      return Response.json(
        { error: `Aucune photo Google Places disponible pour "${place.displayName?.text || query}".` },
        { status: 404 },
      );
    }

    const photoResponse = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&maxHeightPx=800&skipHttpRedirect=true`,
      { headers: { "X-Goog-Api-Key": apiKey } },
    );
    const photoResult = await photoResponse.json() as { photoUri?: string; error?: { message?: string } };
    if (!photoResponse.ok || !photoResult.photoUri) {
      return Response.json({ error: photoResult.error?.message || "Google Places n’a pas renvoyé la photo." }, { status: 502 });
    }

    return Response.json({
      imageUrl: photoResult.photoUri,
      placeName: place.displayName?.text || query,
      address: place.formattedAddress || null,
      source: "Google Places",
    });
  } catch (error) {
    return Response.json({ error: messageFromError(error) }, { status: 500 });
  }
}
