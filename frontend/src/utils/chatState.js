export function settleGeneration(chats, targetIndex, { reply, stopped = false } = {}) {
  return chats.map((chat, index) => {
    if (index !== targetIndex) return chat;

    return {
      ...chat,
      ...(reply === undefined ? {} : { reply }),
      streaming: false,
      stopped,
    };
  });
}
