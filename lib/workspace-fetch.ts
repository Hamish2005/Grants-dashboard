export function isDemoPath(path: string) {
  return path === "/demo" || path.startsWith("/demo/");
}
export async function workspaceFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  if (typeof window !== "undefined" && isDemoPath(window.location.pathname)) {
    const { demoRequest } = await import("./demo/engine");
    return demoRequest(url, init);
  }
  return fetch(url, init);
}
