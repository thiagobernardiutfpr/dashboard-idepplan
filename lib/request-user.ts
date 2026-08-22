export function getRequestUser(request: Request) {
  const dashboardUser = request.headers.get("x-idepplan-user");
  if (dashboardUser) {
    try {
      return decodeURIComponent(dashboardUser);
    } catch {
      return dashboardUser;
    }
  }

  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  const email = request.headers.get("oai-authenticated-user-email");

  if (encodedName) {
    try {
      return encoding === "percent-encoded-utf-8"
        ? decodeURIComponent(encodedName)
        : encodedName;
    } catch {
      return encodedName;
    }
  }

  return email ?? "Usuário autorizado";
}
