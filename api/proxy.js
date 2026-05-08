export const config = { runtime: "edge" };

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MCPS = {
  fathom:     { type: "url", url: "https://api.fathom.ai/mcp",               name: "fathom"     },
  smartsheet: { type: "url", url: "https://mcp.smartsheet.com",              name: "smartsheet" },
  m365:       { type: "url", url: "https://microsoft365.mcp.claude.com/mcp", name: "m365"       },
};

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const { prompt, system, mcps = [], max_tokens = 2000 } = await req.json();
    const body = { model: "claude-sonnet-4-20250514", max_tokens, system: system || "You are a helpful assistant.", messages: [{ role: "user", content: prompt }] };
    if (mcps.length > 0) body.mcp_servers = mcps.map(k => MCPS[k]).filter(Boolean);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    const upstream = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-beta": "mcp-client-2025-04-04" },
      body: JSON.stringify(body),
    });
    const data = await upstream.json();
    return new Response(JSON.stringify(data), { status: upstream.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
}