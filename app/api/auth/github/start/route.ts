import {
  createOAuthState,
  getGitHubConfig,
  redirectResponse,
  stateCookie,
} from "@/app/lib/github-auth";

export async function GET(request: Request) {
  const configured = getGitHubConfig();
  if (!configured.ok) {
    return Response.json({ error: "L’authentification GitHub n’est pas encore configurée." }, { status: 503 });
  }

  try {
    const { config } = configured;
    const oauthState = await createOAuthState(config);
    const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
    authorizeUrl.searchParams.set("client_id", config.clientId);
    authorizeUrl.searchParams.set("redirect_uri", config.redirectUri);
    authorizeUrl.searchParams.set("scope", "read:user");
    authorizeUrl.searchParams.set("state", oauthState.state);
    authorizeUrl.searchParams.set("code_challenge", oauthState.challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("allow_signup", "false");
    authorizeUrl.searchParams.set("login", config.allowedLogin);
    authorizeUrl.searchParams.set("prompt", "select_account");

    return redirectResponse(authorizeUrl.toString(), [stateCookie(request, oauthState.cookieValue)]);
  } catch (error) {
    console.error("[ramco] GitHub OAuth start failed", error);
    return Response.json({ error: "Impossible de démarrer la connexion GitHub." }, { status: 500 });
  }
}
