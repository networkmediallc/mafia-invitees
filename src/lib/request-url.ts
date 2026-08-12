/** Build an absolute URL that works behind Railway/Netlify proxies. */
export function absoluteUrl(request: Request, path: string) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto =
    forwardedProto?.split(",")[0]?.trim() ||
    (host && !host.includes("localhost") ? "https" : "http");

  if (host) {
    return new URL(path, `${proto}://${host}`);
  }
  return new URL(path, request.url);
}
