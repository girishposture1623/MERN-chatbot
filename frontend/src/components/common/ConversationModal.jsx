import Icon from "./Icon.jsx";

export default function ConversationModal({
  modal,
  modalTitle,
  setModalTitle,
  setModal,
  confirmModal,
}) {
  if (!modal) return null;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setModal(null);
      }}
    >
      <div
        className="modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-heading"
      >
        <div className={`modal-icon ${modal.type === "delete" ? "delete-icon" : ""}`}>
          <Icon name={modal.type === "rename" ? "edit" : "warning"} />
        </div>
        <h2 id="modal-heading">
          {modal.type === "rename" ? "Rename conversation" : "Delete conversation?"}
        </h2>
        <p className="modal-description">
          {modal.type === "rename"
            ? "Choose a new name for this conversation."
            : `"${modal.item.title}" and all its messages will be permanently deleted.`}
        </p>

        {modal.type === "rename" && (
          <input
            className="modal-input"
            value={modalTitle}
            onChange={(e) => setModalTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmModal();
            }}
            maxLength={100}
            autoFocus
            placeholder="Conversation name"
          />
        )}

        <div className="modal-actions">
          <button className="modal-cancel" onClick={() => setModal(null)}>
            Cancel
          </button>
          <button
            className={`modal-confirm ${modal.type === "delete" ? "danger" : ""}`}
            onClick={confirmModal}
          >
            {modal.type === "rename" ? "Save changes" : "Delete chat"}
          </button>
        </div>
      </div>
    </div>
  );
}
