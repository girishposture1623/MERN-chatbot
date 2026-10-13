import ChatLogo from "../common/ChatLogo.jsx";
import Icon from "../common/Icon.jsx";
import NeuralPulse from "./NeuralPulse.jsx";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

function hideSafetyMetadata(reply) {
  if (typeof reply !== "string") return "";

  return reply
    .replace(
      /(?:User|Response)\s+Safety\s*:\s*(?:safe|unsafe)(?=\s|$|(?:User|Response)\s+Safety\s*:)/gi,
      "",
    )
    .trim();
}

export default function MessageList({ chats, loading, regenerateReply, endRef }) {
  return (
    <section className="messages">
      {chats.length === 0 && (
        <div className="welcome">
          <div className="welcome-logo"><ChatLogo /></div>
          <h1>What can I help you with?</h1>
          <p>Start a conversation with your AI assistant.</p>
        </div>
      )}

      {chats.map((chat, index) => (
        <div className="message-group" key={chat._id || index}>
          <div className="user-message">{chat.message}</div>
          <div className="bot-message">
            <div className="bot-avatar"><ChatLogo /></div>
            <div className="bot-content">
              <strong>AI Assistant</strong>
              {hideSafetyMetadata(chat.reply) ? (
                <div className="markdown-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkBreaks]}
                    components={{
                      a: ({ href, title, children }) => (
                        <a
                          href={href}
                          title={title}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {hideSafetyMetadata(chat.reply)}
                  </ReactMarkdown>
                </div>
              ) : chat.reply && !chat.streaming ? (
                <p className="stopped-label">
                  This provider did not return a chat response. Regenerate to try again.
                </p>
              ) : chat.streaming && !chat.stopped ? (
                <NeuralPulse />
              ) : chat.stopped ? (
                <p className="stopped-label">Generation stopped.</p>
              ) : null}
              {chat.reply && !loading && !chat.stopped && (
                <button
                  className="regenerate-button"
                  onClick={() => regenerateReply(index)}
                  disabled={loading}
                  type="button"
                >
                  <Icon name="regenerate" size={15} /> Regenerate reply
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </section>
  );
}
