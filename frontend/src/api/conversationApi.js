import { apiRequest } from "./client.js";

export function listConversations(query = "") {
  return apiRequest(`/conversations?q=${encodeURIComponent(query)}`);
}

export function getConversation(id) {
  return apiRequest(`/conversations/${id}`);
}

export function createConversation(options = {}) {
  return apiRequest("/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
    ...options,
  });
}

export function renameConversation(id, title) {
  return apiRequest(`/conversations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export function deleteConversation(id) {
  return apiRequest(`/conversations/${id}`, { method: "DELETE" });
}
