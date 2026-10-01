import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { Icon } from "../Icon";

export interface ModalOptions {
  title: string;
  body: ReactNode;
  /** Defaults to a single "Close" ghost button, matching the source's showModal() default foot. */
  foot?: ReactNode;
  wide?: boolean;
  extraWide?: boolean;
}

interface ModalContextValue {
  showModal: (opts: ModalOptions) => void;
  closeModal: () => void;
  /** Matches the source's confirmModal(title, msg, onYes, danger). */
  confirm: (title: string, message: string, onConfirm: () => void, danger?: boolean) => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalOptions | null>(null);

  const closeModal = useCallback(() => setModal(null), []);
  const showModal = useCallback((opts: ModalOptions) => setModal(opts), []);

  const confirm = useCallback(
    (title: string, message: string, onConfirm: () => void, danger?: boolean) => {
      setModal({
        title,
        body: <p style={{ margin: 0, color: "var(--text-soft)", fontSize: 13.5, lineHeight: 1.6 }}>{message}</p>,
        foot: (
          <>
            <button type="button" className="button button--ghost" onClick={closeModal}>Cancel</button>
            <button
              type="button"
              className={"button " + (danger ? "button--danger" : "button--primary")}
              onClick={() => {
                closeModal();
                onConfirm();
              }}
            >
              Confirm
            </button>
          </>
        ),
      });
    },
    [closeModal]
  );

  useEffect(() => {
    if (!modal) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modal, closeModal]);

  return (
    <ModalContext.Provider value={{ showModal, closeModal, confirm }}>
      {children}
      {modal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className={"modal" + (modal.wide ? " modal--wide" : "") + (modal.extraWide ? " modal--extra-wide" : "")}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-head">
              <h3>{modal.title}</h3>
              <button type="button" className="close-x" aria-label="Close" onClick={closeModal}>
                <Icon name="x" size="sm" />
              </button>
            </div>
            <div className="modal-body">{modal.body}</div>
            <div className="modal-foot">
              {modal.foot ?? (
                <button type="button" className="button button--ghost" onClick={closeModal}>Close</button>
              )}
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used within a ModalProvider");
  return ctx;
}
