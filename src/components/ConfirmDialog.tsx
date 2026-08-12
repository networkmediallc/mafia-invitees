"use client";

export function ConfirmDialog({
  open,
  message,
  confirmLabel = "Yes",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="editor-backdrop"
      role="presentation"
      onClick={(e) => {
        e.stopPropagation();
        onCancel();
      }}
    >
      <div
        className="choice-panel confirm-panel"
        role="alertdialog"
        aria-modal="true"
        aria-label="Confirm"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="choice-copy confirm-message">{message}</p>
        <div className="choice-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="primary-btn" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
