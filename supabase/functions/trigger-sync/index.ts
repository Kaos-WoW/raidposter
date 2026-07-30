// Triggered den GitHub-Workflow "Sync Roster and Gear" über die GitHub API
// nachdem geprüft wurde, ob der anfragende Nutzer in Supabase eingeloggt ist.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // 1. Authentifizierung prüfen
    const authHeader = req.headers.get("Authorization") ?? "";
    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supa.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Nicht angemeldet." }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // 2. GITHUB_TOKEN laden
    const githubToken = Deno.env.get("GITHUB_TOKEN");
    if (!githubToken) {
      return new Response(
        JSON.stringify({ error: "GITHUB_TOKEN ist in den Supabase Secrets nicht gesetzt." }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // 3. GitHub Actions Workflow per API dispatchen
    const ghRes = await fetch(
      "https://api.github.com/repos/Kaos-WoW/loot-prio/actions/workflows/sync.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "Supabase-Edge-Function-Lootprio",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "main",
        }),
      }
    );

    if (!ghRes.ok) {
      const body = await ghRes.text();
      return new Response(
        JSON.stringify({ error: `GitHub-API-Fehler ${ghRes.status}: ${body}` }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
