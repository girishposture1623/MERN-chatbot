import { apiRequest } from "./client.js";

export function streamMessage(id, message, options = {}) {
  return apiRequest(`/conversations/${id}/messages/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
    ...options,
  });
}

export function regenerateMessage(id, chatId, options = {}) {
  return apiRequest(`/conversations/${id}/messages/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId }),
    ...options,
  });
}
