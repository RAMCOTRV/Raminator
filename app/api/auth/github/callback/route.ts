import {
  appRoot,
  clearAuthCookies,
  createSession,
  getGitHubConfig,
  readOAuthState,
  redirectResponse,
  redirectWithError,
  sessionCookie,
} from "@/app/lib/github-auth";

type GitHubTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GitHubUserResponse = {
  id?: number;
  login?: string;
  name?: string | null;
  avatar_url?: string | null;
};

export async function GET(request: Request) {
  const configured = getGitHubConfig();
  if (!configured.ok) {
    return Response.json({ error: "L’authentification GitHub n’est pas encore configurée." }, { status: 503 });
  }

  const { config } = configured;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");

  if (providerError || !code || !state) {
    return redirectResponse(
      redirectWithError(config, providerError === "access_denied" ? "cancelled" : "invalid_callback"),
      clearAuthCookies(request),
    );
  }

  const verifier = await readOAuthState(request, config, state);
  if (!verifier) {
    return redirectResponse(redirectWithError(config, "invalid_state"), clearAuthCookies(request));
  }

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        code_verifier: verifier,
      }),
    });
    const tokenResult = await tokenResponse.json() as GitHubTokenResponse;
    if (!tokenResponse.ok || !tokenResult.access_token) throw new Error(tokenResult.error_description || "token_exchange_failed");

    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${tokenResult.access_token}`,
        "User-Agent": "Ramco-Brochure-Studio",
      },
    });
    const githubUser = await userResponse.json() as GitHubUserResponse;
    if (!userResponse.ok || !githubUser.id || !githubUser.login) throw new Error("identity_lookup_failed");

    if (githubUser.login.toLowerCase() !== config.allowedLogin) {
      return redirectResponse(redirectWithError(config, "not_allowed"), clearAuthCookies(request));
    }

    const user = {
      id: githubUser.id,
      login: githubUser.login,
      name: githubUser.name || null,
      avatarUrl: githubUser.avatar_url || null,
    };
    const signedSession = await createSession(config, user);
    return redirectResponse(appRoot(config), [
      ...clearAuthCookies(request),
      sessionCookie(request, signedSession),
    ]);
  } catch {
    return redirectResponse(redirectWithError(config, "github_unavailable"), clearAuthCookies(request));
  }
}
