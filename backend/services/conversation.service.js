import Chat from "../models/Chat.js";

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getHistoryMessages(conversationId) {
  const previous = await Chat.find({ conversationId })
    .sort({ createdAt: 1 })
    .limit(30)
    .lean();
  const messages = [];
  for (const chat of previous) {
    if (chat.message) messages.push({ role: "user", content: chat.message });
    if (chat.reply) messages.push({ role: "assistant", content: chat.reply });
  }
  return { previous, messages };
}

export async function saveConversationReply({ conversation, conversationId, message, reply, previous }) {
  const savedChat = await Chat.create({ conversationId, message, reply });
  if (conversation.title === "New chat" && previous.length === 0) {
    conversation.title = message.slice(0, 60);
  }
  conversation.updatedAt = new Date();
  await conversation.save();
  return savedChat;
}
