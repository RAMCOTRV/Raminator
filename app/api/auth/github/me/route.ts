import { getGitHubConfig, readSession } from "@/app/lib/github-auth";

export async function GET(request: Request) {
  const configured = getGitHubConfig();
  if (!configured.ok) return Response.json({ authenticated: false, configured: false }, { status: 503 });

  const session = await readSession(request, configured.config);
  if (!session) return Response.json({ authenticated: false, configured: true });

  return Response.json({
    authenticated: true,
    configured: true,
    user: {
      id: session.id,
      login: session.login,
      name: session.name,
      avatarUrl: session.avatarUrl,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
