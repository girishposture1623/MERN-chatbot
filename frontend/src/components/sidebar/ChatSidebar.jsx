import ChatLogo from "../common/ChatLogo.jsx";
import Icon from "../common/Icon.jsx";

export default function ChatSidebar({
  history,
  activeId,
  loading,
  search,
  setSearch,
  openChat,
  startRename,
  startDelete,
  newChat,
  sidebarCollapsed,
  setSidebarCollapsed,
  dark,
  setDark,
  setMobileSidebarOpen,
  startResize,
}) {
  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-top-actions">
          <button
            className="icon-button desktop-collapse"
            onClick={() => setSidebarCollapsed((v) => !v)}
            title="Collapse or expand sidebar"
            aria-label="Toggle sidebar"
          >
            <Icon name="menu" />
          </button>
          <button
            className="icon-button mobile-menu-close"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="brand">
          <span className="brand-logo"><ChatLogo /></span>
          <strong>ChatBot</strong>
        </div>

        <button className="new-chat" onClick={newChat}>
          <span className="plus-icon"><Icon name="plus" /></span>
          <span className="new-chat-label">New chat</span>
        </button>

        <label className="search-box">
          <span className="search-icon"><Icon name="search" /></span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
          />
          {search && (
            <button
              type="button"
              className="clear-search"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </label>

        <div className="section-label">YOUR CONVERSATIONS</div>
        <div className="history-list">
          {history.length === 0 ? (
            <p className="empty-history">
              {search ? "No matching chats" : "No chats yet"}
            </p>
          ) : (
            history.map((item) => (
              <div
                className={`history-item ${activeId === item._id ? "active" : ""}`}
                key={item._id}
              >
                <button
                  className="history-open"
                  onClick={() => openChat(item._id)}
                  disabled={loading}
                  title={item.title}
                >
                  <span className="history-icon"><Icon name="message" size={16} /></span>
                  <span className="history-text">{item.title}</span>
                </button>
                <div className="history-actions">
                  <button
                    type="button"
                    title="Rename"
                    aria-label="Rename conversation"
                    onClick={() => startRename(item)}
                  >
                    <Icon name="edit" size={15} />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    aria-label="Delete conversation"
                    onClick={() => startDelete(item)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <button className="theme-toggle" onClick={() => setDark((v) => !v)}>
          <span className="theme-icon">
            <Icon name={dark ? "sun" : "moon"} size={19} />
          </span>
          <span>{dark ? "Light mode" : "Dark mode"}</span>
        </button>
        <div className="sidebar-footer">  Powered by <b>GIRISH</b></div>
      </aside>

      {!sidebarCollapsed && (
        <div
          className="sidebar-resizer"
          onPointerDown={startResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
        />
      )}
    </>
  );
}