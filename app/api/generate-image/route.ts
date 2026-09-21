import { getGitHubConfig, readSession } from "@/app/lib/github-auth";

export async function POST(request: Request) {
  const configured = getGitHubConfig();
  if (!configured.ok || !(await readSession(request, configured.config))) {
    return Response.json({ error: "Connectez-vous avec GitHub." }, { status: 401 });
  }

  void request;
  return Response.json(
    { error: "La génération d’images est désactivée. Le programme est disponible sans photo." },
    { status: 410 },
  );
}
