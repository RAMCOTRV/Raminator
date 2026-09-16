import { appRoot, clearAuthCookies, getGitHubConfig, redirectResponse } from "@/app/lib/github-auth";

export async function GET(request: Request) {
  const configured = getGitHubConfig();
  if (!configured.ok) return Response.json({ error: "L’authentification GitHub n’est pas encore configurée." }, { status: 503 });

  return redirectResponse(appRoot(configured.config), clearAuthCookies(request));
}
