const ANTHROPIC = "https://api.anthropic.com/v1/messages";
const MCP_FATHOM = { type: "url", url: "https://api.fathom.ai/mcp", name: "fathom" };
const MCP_SS = { type: "url", url: "https://mcp.smartsheet.com", name: "smartsheet" };
const MCP_M365 = { type: "url", url: "https://microsoft365.mcp.claude.com/mcp", name: "m365" };

function extractAllText(content) {
  if (!content || !Array.isArray(content)) return "";
  return content.map(b => {
    if (b.type === "text") return b.text || "";
    if (b.type === "mcp_tool_result") {
      if (Array.isArray(b.content)) return b.content.map(c => c.text || "").join("\n");
      return String(b.content || "");
    }
    return "";
  }).filter(Boolean).join("\n");
}

async function callAnthropic(prompt, system, mcps, key) {
  const body = { model: "claude-sonnet-4-5", max_tokens: 2000, system, messages: [{ role: "user", content: prompt }] };
  const headers = { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" };
  if (mcps && mcps.length) { body.mcp_servers = mcps; headers["anthropic-beta"] = "mcp-client-2025-04-04"; }
  const r = await fetch(ANTHROPIC, { method: "POST", headers, body: JSON.stringify(body) });
  const d = await r.json();
  return { text: extractAllText(d.content), raw: d.content, error: d.error };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  const KEY = process.env.ANTHROPIC_API_KEY;
  try {
    const body = req.body;
    if (body.action === "getSummary") {
      const result = await callAnthropic(
        "Call get_meeting_summary for recording_id " + body.recordingId + ". Return the complete summary text verbatim.",
        "Use the Fathom MCP get_meeting_summary tool and return ALL the summary content.",
        [MCP_FATHOM], KEY
      );
      res.json({ summary: result.text, debugTypes: (result.raw||[]).map(b=>b.type), apiError: result.error });
      return;
    }
    if (body.action === "draftEmail") {
      const result = await callAnthropic(body.prompt, "You are a professional meeting recap email writer. Be specific and detailed. Follow the format exactly.", [], KEY);
      res.json({ text: result.text }); return;
    }
    if (body.action === "smartsheet") {
      const result = await callAnthropic(body.prompt, "Use Smartsheet MCP. Confirm briefly.", [MCP_SS], KEY);
      res.json({ text: result.text }); return;
    }
    if (body.action === "email") {
      const result = await callAnthropic(body.prompt, "Use Microsoft 365 MCP to send the email. Confirm briefly.", [MCP_M365], KEY);
      res.json({ text: result.text }); return;
    }
    res.status(400).json({ error: "Unknown action" });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}