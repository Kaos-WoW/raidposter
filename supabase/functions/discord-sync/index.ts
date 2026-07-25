// Holt die neueste Raid-Helper-Setup-Nachricht aus dem Montag- oder Donnerstag-Kanal
// und gibt sie als Text zurück - im selben Format, das man sonst per Copy-Paste aus
// Discord einfügen würde, damit der bestehende Parser (parseImportText) sie
// unverändert verarbeiten kann.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHANNEL_IDS: Record<string, string> = {
  monday: Deno.env.get("CHANNEL_ID_MONDAY") ?? "",
  thursday: Deno.env.get("CHANNEL_ID_THURSDAY") ?? "",
};

function embedToText(embed: any): string {
  const out: string[] = [];
  if (embed.title) out.push(embed.title);
  out.push("");
  if (embed.description) {
    out.push(...String(embed.description).split("\n"));
    out.push("");
  }
  for (const f of embed.fields ?? []) {
    out.push(f.name ?? "");
    out.push(...String(f.value ?? "").split("\n"));
    out.push("");
  }
  if (embed.footer?.text) out.push(embed.footer.text);
  return out.join("\n")
    // Discord-Custom-Emoji <a?:name:id> -> :name: (gleiche Form wie beim Copy-Paste)
    .replace(/<a?:(\w+):\d+>/g, ":$1:");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // Nur echte, per Passwort eingeloggte Nutzer dürfen synchronisieren - der
    // öffentliche Anon-Key allein (ohne Login) reicht nicht.
    const authHeader = req.headers.get("Authorization") ?? "";
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

    const { day } = await req.json();
    const channelId = CHANNEL_IDS[day];
    if (!channelId) {
      return new Response(JSON.stringify({ error: `Unbekannter oder nicht konfigurierter Tag: ${day}` }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) {
      return new Response(JSON.stringify({ error: "DISCORD_BOT_TOKEN ist serverseitig nicht gesetzt." }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=25`, {
      headers: { Authorization: `Bot ${botToken}` },
    });

    if (!res.ok) {
      const body = await res.text();
      return new Response(JSON.stringify({ error: `Discord-API-Fehler ${res.status}: ${body}` }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const messages: any[] = await res.json();
    // Discord liefert neueste zuerst - erste Bot-Nachricht mit Embed nehmen
    const msg = messages.find((m) => m.author?.bot && Array.isArray(m.embeds) && m.embeds.length > 0);

    if (!msg) {
      return new Response(JSON.stringify({ error: "Keine passende Raid-Helper-Nachricht im Kanal gefunden." }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const text = embedToText(msg.embeds[0]);
    return new Response(JSON.stringify({ text }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
