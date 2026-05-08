export const config = { runtime: "edge" };
const ANTHROPIC = "https://api.anthropic.com/v1/messages";
const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
const MCP_FATHOM = { type: "url", url: "https://api.fathom.ai/mcp", name: "fathom" };
const MCP_SS = { type: "url", url: "https://mcp.smartsheet.com", name: "smartsheet" };
const MCP_M365 = { type: "url", url: "https://microsoft365.mcp.claude.com/mcp", name: "m365" };
async function callAnthropic(prompt, system, mcps, key) {
  const body = { model: "claude-sonnet-4-20250514", max_tokens: 1500, system: system, messages: [{ role: "user", content: prompt }] };
  const headers = { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" };
  if (mcps && mcps.length) { body.mcp_servers = mcps; headers["anthropic-beta"] = "mcp-client-2025-04-04"; }
  const r = await fetch(ANTHROPIC, { method: "POST", headers, body: JSON.stringify(body) });
  const d = await r.json();
  return (d.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
}
export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const KEY = process.env.ANTHROPIC_API_KEY;
  try {
    const body = await req.json();
    if (body.action === "getSummary") {
      const text = await callAnthropic(
        "Call get_meeting_summary for recording_id " + body.recordingId + ". Return the full summary text exactly as returned.",
        "Use the Fathom MCP get_meeting_summary tool and return the full summary text.",
        [MCP_FATHOM], KEY
      );
      return new Response(JSON.stringify({ summary: text }), { headers: cors });
    }
    if (body.action === "draftEmail") {
      const text = await callAnthropic(body.prompt, "You are a professional meeting recap email writer. Be specific and detailed using the provided summary.", [], KEY);
      return new Response(JSON.stringify({ text }), { headers: cors });
    }
    if (body.action === "smartsheet") {
      const text = await callAnthropic(body.prompt, "Use Smartsheet MCP. Confirm briefly.", [MCP_SS], KEY);
      return new Response(JSON.stringify({ text }), { headers: cors });
    }
    if (body.action === "email") {
      const text = await callAnthropic(body.prompt, "Use Microsoft 365 MCP to send the email. Confirm briefly.", [MCP_M365], KEY);
      return new Response(JSON.stringify({ text }), { headers: cors });
    }
    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: cors });
  } catch(err) {
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { status: 500, headers: cors });
  }
}