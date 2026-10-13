export async function readAssistantReply(response, onUpdate = () => {}) {
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";

  if (contentType.includes("json")) {
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("The backend returned malformed JSON instead of a reply.");
    }

    const reply =
      typeof payload?.reply === "string"
        ? payload.reply
        : typeof payload?.chat?.reply === "string"
          ? payload.chat.reply
          : null;

    if (!reply?.trim()) {
      throw new Error(
        payload?.error || "The backend response did not contain an assistant reply.",
      );
    }

    onUpdate(reply);
    return reply;
  }

  if (contentType.includes("text/html")) {
    throw new Error(
      "The API returned an HTML page. Check the production VITE_API_URL and Render route.",
    );
  }

  if (!response.body) {
    throw new Error("Streaming response unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let reply = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      reply += decoder.decode(value, { stream: true });
      onUpdate(reply);
    }

    reply += decoder.decode();
    onUpdate(reply);
  } finally {
    reader.releaseLock();
  }

  if (!reply.trim()) {
    throw new Error("The backend completed the stream without assistant text.");
  }

  return reply;
}
