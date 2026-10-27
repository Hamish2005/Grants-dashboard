// Enforce a streaming limit even when Content-Length is absent or dishonest.
export async function limitedBody(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        await reader.cancel();
        throw new Error("Request exceeds the upload size limit");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
export async function limitedJson(request: Request, limit = 1_000_000) {
  return JSON.parse(
    new TextDecoder().decode(await limitedBody(request, limit)),
  );
}
export async function limitedForm(request: Request, limit: number) {
  const bytes = await limitedBody(request, limit);
  return new Response(bytes, {
    headers: { "Content-Type": request.headers.get("content-type") || "" },
  }).formData();
}
