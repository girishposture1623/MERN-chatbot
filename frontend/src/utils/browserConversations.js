export const CONVERSATIONS_STORAGE_KEY = "mern-chatbot-conversations";

export function loadBrowserConversations() {
  try {
    const stored = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    if (!stored) return [];

    const conversations = JSON.parse(stored);
    if (!Array.isArray(conversations)) return [];

    return conversations
      .filter(
        (conversation) =>
          conversation &&
          typeof conversation._id === "string" &&
          typeof conversation.title === "string" &&
          Array.isArray(conversation.chats),
      )
      .map((conversation) => ({
        ...conversation,
        chats: conversation.chats.filter(
          (chat) =>
            chat &&
            typeof chat.message === "string" &&
            typeof chat.reply === "string",
        ),
      }));
  } catch (error) {
    console.warn("Could not read browser chat history:", error);
    return [];
  }
}

export function saveBrowserConversations(conversations) {
  try {
    localStorage.setItem(
      CONVERSATIONS_STORAGE_KEY,
      JSON.stringify(conversations),
    );
    return true;
  } catch (error) {
    console.warn("Could not save browser chat history:", error);
    return false;
  }
}
