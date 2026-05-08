export const config = { runtime: "edge" };
const ANTHROPIC = "https://api.anthropic.com/v1/messages";
const FATHOM = "https://api.fathom.video/v1";
const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const FATHOM_KEY = process.env.FATHOM_API_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  try {
    const body = await req.json();
    // Route: search Fathom calls by keyword
    if (body.action === "searchCalls") {
      const url = FATHOM + "/calls?limit=100";
      const r = await fetch(url, { headers: { Authorization: "Bearer " + FATHOM_KEY } });
      const data = await r.json();
      const calls = (data.data || data.calls || data || []);
      const kw = (body.keyword || "").toLowerCase();
      const filtered = calls.filter(function(c) {
        var title = (c.title || c.name || "").toLowerCase();
        return title.includes(kw);
      }).map(function(c) {
        return { id: String(c.id || c.recording_id), title: c.title || c.name, date: (c.created_at || c.date || "").slice(0,10), url: c.url || ("https://fathom.video/calls/" + c.id) };
      });
      return new Response(JSON.stringify({ calls: filtered }), { headers: cors });
    }
    // Route: get summary for a call
    if (body.action === "getSummary") {
      const r = await fetch(FATHOM + "/calls/" + body.callId + "/summary", { headers: { Authorization: "Bearer " + FATHOM_KEY } });
      const data = await r.json();
      return new Response(JSON.stringify(data), { headers: cors });
    }
    // Route: draft email via Claude
    if (body.action === "draftEmail") {
      const r = await fetch(ANTHROPIC, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1500, system: "You are a professional meeting recap email writer. Write detailed, specific recap emails using the provided summary content.", messages: [{ role: "user", content: body.prompt }] })
      });
      const data = await r.json();
      const text = (data.content || []).filter(function(b){ return b.type === "text"; }).map(function(b){ return b.text; }).join("\n");
      return new Response(JSON.stringify({ text: text }), { headers: cors });
    }
    // Route: push to Smartsheet or send email via MCP
    if (body.action === "mcp") {
      const MCPS = { smartsheet: { type: "url", url: "https://mcp.smartsheet.com", name: "smartsheet" }, m365: { type: "url", url: "https://microsoft365.mcp.claude.com/mcp", name: "m365" } };
      const mcpBody = { model: "claude-sonnet-4-20250514", max_tokens: 500, system: "You are a helpful assistant.", messages: [{ role: "user", content: body.prompt }], mcp_servers: [MCPS[body.service]].filter(Boolean) };
      const r = await fetch(ANTHROPIC, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "anthropic-beta": "mcp-client-2025-04-04" }, body: JSON.stringify(mcpBody) });
      const data = await r.json();
      const text = (data.content || []).filter(function(b){ return b.type === "text"; }).map(function(b){ return b.text; }).join("\n");
      return new Response(JSON.stringify({ text: text }), { headers: cors });
    }
    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: cors });
  } catch(err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}