declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ANTHROPIC_API_KEY?: string;
    OPENAI_API_KEY?: string;
    GEMINI_API_KEY?: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    GITHUB_OAUTH_REDIRECT_URI?: string;
    GITHUB_SESSION_SECRET?: string;
    GITHUB_ALLOWED_LOGIN?: string;
  }
}
