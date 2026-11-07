import { publicBaseUrl } from "@/lib/agent/oauth";

/** RFC 9728 protected-resource metadata for /api/mcp. Served at both the bare and the path-suffixed (/api/mcp) location, since MCP clients try either. */
export function GET(req: Request) {
  const base = publicBaseUrl(req);
  return Response.json(
    {
      resource: `${base}/api/mcp`,
      authorization_servers: [base],
      bearer_methods_supported: ["header"],
      resource_name: "Project System",
    },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}
