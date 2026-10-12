import { useLayoutEffect, useRef } from "react";
import Icon from "../common/Icon.jsx";

export default function MessageComposer({
  message,
  setMessage,
  loading,
  streaming,
  sendMessage,
  stopGeneration,
}) {
  const textareaRef = useRef(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const maxHeight = 200;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [message]);

  return (
    <form className="input-area" onSubmit={sendMessage}>
      <textarea
        ref={textareaRef}
        rows={1}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (
            e.key === "Enter" &&
            !e.shiftKey &&
            !e.nativeEvent.isComposing
          ) {
            e.preventDefault();
            void sendMessage(e);
          }
        }}
        placeholder="Message your AI assistant..."
        disabled={loading}
      />

      {streaming ? (
        <button
          type="button"
          className="stop-button"
          onClick={stopGeneration}
        >
          <Icon name="close" size={15} /> Stop
        </button>
      ) : (
        <button
          className="send-button"
          type="submit"
          disabled={loading || !message.trim()}
          aria-label="Send message"
        >
          <Icon name="send" size={19} />
        </button>
      )}
    </form>
  );
}
