import { appRoot, clearAuthCookies, getGitHubConfig } from "@/app/lib/github-auth";

export async function GET(request: Request) {
  const configured = getGitHubConfig();
  if (!configured.ok) return Response.json({ error: "L’authentification GitHub n’est pas encore configurée." }, { status: 503 });

  const response = Response.redirect(appRoot(configured.config), 302);
  for (const cookie of clearAuthCookies(request)) response.headers.append("Set-Cookie", cookie);
  return response;
}
