export function corsHeaders() {
  // Chrome extensions + phone browsers will call this API.
  // We don't use cookies; auth is via Bearer token.
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
  } as Record<string, string>;
}
