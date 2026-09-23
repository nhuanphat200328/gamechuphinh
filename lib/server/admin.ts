/**
 * Optional admin protection. When `ADMIN_TOKEN` is set, mutating admin
 * endpoints require a matching `x-admin-token` header. When it is unset the
 * endpoints stay open (handy for local development).
 */
export function isAdminRequest(request: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return true;
  return request.headers.get("x-admin-token") === expected;
}

export function adminRequiredResponse(): Response {
  return Response.json(
    { error: "Unauthorized", code: "UNAUTHORIZED" },
    { status: 401 },
  );
}
