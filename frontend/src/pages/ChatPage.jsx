
import { useEffect, useMemo, useRef, useState } from "react";
import "../styles/chat.css";
import ConversationModal from "../components/common/ConversationModal.jsx";
import MessageComposer from "../components/chat/MessageComposer.jsx";
import MessageList from "../components/chat/MessageList.jsx";
import ChatSidebar from "../components/sidebar/ChatSidebar.jsx";
import Icon from "../components/common/Icon.jsx";
import { settleGeneration } from "../utils/chatState.js";
import { readAssistantReply } from "../utils/readAssistantReply.js";
import {
  loadBrowserConversations,
  saveBrowserConversations,
} from "../utils/browserConversations.js";
import {
  createConversation as createConversationRequest,
  deleteConversation,
  getConversation,
  renameConversation,
} from "../api/conversationApi.js";
import {
  regenerateMessage as requestRegenerateMessage,
  streamMessage as requestMessageStream,
} from "../api/messageApi.js";

export default function ChatPage() {
  const [history, setHistory] = useState(loadBrowserConversations);
  const [activeId, setActiveId] = useState(null);
  const [chats, setChats] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [dark, setDark] = useState(
    () =>
      typeof localStorage !== "undefined" &&
      localStorage.getItem("chat-theme") === "dark"
  );
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [modalTitle, setModalTitle] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const width = Number(localStorage.getItem("sidebar-width"));
    return width >= 220 && width <= 420 ? width : 275;
  });

  const conversationsToPersist = useMemo(
    () =>
      history.map((conversation) =>
        conversation._id === activeId
          ? { ...conversation, chats }
          : conversation,
      ),
    [history, activeId, chats],
  );
  const filteredHistory = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversationsToPersist;

    return conversationsToPersist.filter((conversation) => {
      const contents = (conversation.chats || [])
        .map((chat) => `${chat.message || ""} ${chat.reply || ""}`)
        .join(" ");
      return `${conversation.title || ""} ${contents}`
        .toLowerCase()
        .includes(query);
    });
  }, [conversationsToPersist, search]);

  const endRef = useRef(null);
  const abortRef = useRef(null);
  const resizingRef = useRef(false);
  const sendLockRef = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("chat-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    saveBrowserConversations(conversationsToPersist);
  }, [conversationsToPersist]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") {
        setModal(null);
        setMobileSidebarOpen(false);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    function move(e) {
      if (!resizingRef.current) return;
      const width = Math.min(420, Math.max(220, e.clientX));
      setSidebarWidth(width);
      localStorage.setItem("sidebar-width", String(width));
    }

    function stop() {
      resizingRef.current = false;
      document.body.classList.remove("resizing-sidebar");
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.body.classList.remove("resizing-sidebar");
    };
  }, []);

  async function refreshConversation(id) {
    const res = await getConversation(id);

    if (!res.ok) {
      throw new Error("Could not refresh conversation");
    }

    const data = await res.json();
    setChats(data.chats || []);
    setActiveId(id);
    setHistory((previous) =>
      previous
        .map((item) =>
          item._id === id
            ? { ...item, ...data.conversation, chats: data.chats || [] }
            : item,
        )
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    );
    return data.chats || [];
  }

  function startResize(e) {
    if (window.innerWidth <= 768 || sidebarCollapsed) return;

    e.preventDefault();
    resizingRef.current = true;
    document.body.classList.add("resizing-sidebar");
  }

  async function openChat(id) {
    if (loading) return;

    const conversation = history.find((item) => item._id === id);
    if (!conversation) {
      setError("This conversation is not saved in this browser.");
      return;
    }

    setError("");
    setActiveId(id);
    setChats(conversation.chats || []);
    setMessage("");
    setMobileSidebarOpen(false);
  }

  function newChat() {
    if (loading) return;

    setActiveId(null);
    setChats([]);
    setMessage("");
    setSearch("");
    setError("");
    setMobileSidebarOpen(false);
  }

  function startRename(item) {
    setModalTitle(item.title || "");
    setModal({ type: "rename", item });
  }

  function startDelete(item) {
    setModal({ type: "delete", item });
  }

  async function confirmModal() {
    if (!modal) return;

    const { type, item } = modal;

    try {
      setError("");

      if (type === "rename") {
        const title = modalTitle.trim();

        if (!title || title.length > 100) {
          setError("Title must contain 1 to 100 characters.");
          return;
        }

        const res = await renameConversation(item._id, title);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Rename failed");

        setHistory((previous) =>
          previous.map((conversation) =>
            conversation._id === item._id
              ? { ...conversation, ...data, title }
              : conversation,
          ),
        );
      } else {
        const res = await deleteConversation(item._id);

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Delete failed");
        }

        if (activeId === item._id) {
          setActiveId(null);
          setChats([]);
          setMessage("");
        }

        setHistory((previous) =>
          previous.filter((conversation) => conversation._id !== item._id),
        );
      }

      setModal(null);
    } catch (err) {
      setError(err.message || "Action failed");
    }
  }

  async function streamMessage(text, options = {}) {
    const { regenerateIndex = null } = options;

    if (!text.trim() || loading) return;

    const originalChats = chats;
    const isRegenerate = regenerateIndex !== null;
    const targetChat = isRegenerate
      ? originalChats[regenerateIndex]
      : null;

    if (isRegenerate && (!activeId || !targetChat?._id)) {
      setError(
        "This reply is not saved yet. Send a new message and try again."
      );
      return;
    }

    setError("");
    setLoading(true);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let id = activeId;
    let targetIndex = -1;
    let inserted = false;

    try {
      // Create a conversation only for a new message.
      if (!id) {
        const createRes = await createConversationRequest({
          signal: controller.signal,
        });

        const created = await createRes.json();

        if (!createRes.ok) {
          throw new Error(
            created.error || "Could not create conversation"
          );
        }

        id = created._id;
        setHistory((previous) =>
          previous.some((conversation) => conversation._id === id)
            ? previous
            : [
                { ...created, chats: [] },
                ...previous,
              ],
        );
        setActiveId(id);
      }

      if (!isRegenerate) {
        targetIndex = originalChats.length;
        inserted = true;

        setChats((prev) => [
          ...prev,
          {
            message: text,
            reply: "",
            streaming: true,
            temporary: true,
          },
        ]);
      } else {
        targetIndex = regenerateIndex;

        setChats((prev) =>
          prev.map((chat, i) =>
            i === targetIndex
              ? { ...chat, reply: "", streaming: true, stopped: false }
              : chat
          )
        );
      }

      const res = isRegenerate
        ? await requestRegenerateMessage(id, targetChat._id, {
            signal: controller.signal,
          })
        : await requestMessageStream(id, text, {
            signal: controller.signal,
          });

      if (!res.ok) {
        let reason = "Reply failed";

        try {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await res.json();
            reason = data.error || reason;
          } else if (!contentType.includes("text/html")) {
            const body = (await res.text()).trim();
            if (body) reason = body.slice(0, 300);
          } else {
            reason = `Backend request failed (${res.status}). Check VITE_API_URL and the Render service.`;
          }
        } catch {
          // Keep the fallback message when the response is not JSON.
        }

        throw new Error(reason);
      }

      await readAssistantReply(res, (nextReply) => {
        setChats((prev) =>
          prev.map((chat, i) =>
            i === targetIndex
              ? { ...chat, reply: nextReply, streaming: true }
              : chat,
          ),
        );
      });

      // Fetch the saved MongoDB chat IDs after generation finishes.
      await refreshConversation(id);
    } catch (err) {
      if (err.name === "AbortError") {
        setChats((prev) =>
          settleGeneration(prev, targetIndex, { stopped: true })
        );

        // Refresh only if the server has saved the message.
        if (id) {
          try {
            await refreshConversation(id);
          } catch {
            // Keep the visible state if refresh fails.
          }
        }
      } else {
        setError(
          err instanceof TypeError
            ? "Could not reach the AI backend. Check VITE_API_URL, Render service status, and backend CORS configuration."
            : err.message || "Something went wrong",
        );
        setChats((prev) =>
          settleGeneration(prev, targetIndex, {
            reply: isRegenerate ? targetChat.reply : undefined,
          })
        );

        // Restore saved data if the request failed.
        if (id) {
          try {
            await refreshConversation(id);
          } catch {
            if (inserted) {
              setChats((prev) =>
                prev.filter((chat) => !chat.temporary)
              );
            }
          }
        }
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      setLoading(false);
    }
  }

  async function sendMessage(e) {
    e?.preventDefault();

    const text = message.trim();

    if (!text || loading || sendLockRef.current) return;

    sendLockRef.current = true;
    try {
      setMessage("");
      await streamMessage(text);
    } finally {
      sendLockRef.current = false;
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
  }

  async function regenerateReply(index) {
    if (loading) return;

    const chat = chats[index];

    if (!chat?._id) {
      setError(
        "This message is not saved in the database yet. Please refresh the conversation."
      );
      return;
    }

    await streamMessage(chat.message, {
      regenerateIndex: index,
    });
  }

  return (
    <div
      className={`app ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${
        mobileSidebarOpen ? "mobile-sidebar-open" : ""
      }`}
      style={{ "--sidebar-width": `${sidebarWidth}px` }}
    >
      {mobileSidebarOpen && (
        <button
          className="drawer-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <ChatSidebar
        history={filteredHistory}
        activeId={activeId}
        loading={loading}
        search={search}
        setSearch={setSearch}
        openChat={openChat}
        startRename={startRename}
        startDelete={startDelete}
        newChat={newChat}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        dark={dark}
        setDark={setDark}
        setMobileSidebarOpen={setMobileSidebarOpen}
        startResize={startResize}
      />
      <main className="chat">
        <header className="chat-header">
          <button
            className="icon-button mobile-menu-open"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Icon name="menu" />
          </button>

          <div className="header-title">
            <strong>AI Assistant</strong>
            <small>Your personal AI companion</small>
          </div>

          <span className="online-label">&#9679; Online</span>
        </header>

        <MessageList
          chats={chats}
          loading={loading}
          regenerateReply={regenerateReply}
          endRef={endRef}
        />
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}

        <MessageComposer
          message={message}
          setMessage={setMessage}
          loading={loading}
          streaming={streaming}
          sendMessage={sendMessage}
          stopGeneration={stopGeneration}
        />
        <p className="disclaimer">
          AI can make mistakes. Verify important information.
        </p>
      </main>

      <ConversationModal
        modal={modal}
        modalTitle={modalTitle}
        setModalTitle={setModalTitle}
        setModal={setModal}
        confirmModal={confirmModal}
      />
    </div>
  );
}
