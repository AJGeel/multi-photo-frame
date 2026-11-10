"use client";

import { Toast } from "@base-ui/react/toast";
import { AlertCircle, Check, Close, Spinner } from "./icons";
import { Button, IconButton } from "./ui";

export interface ToastData {
  /** 0 to 100, for progress toasts. */
  percent?: number;
  onCancel?: () => void;
  onRetry?: () => void;
}

export const toastManager = Toast.createToastManager<ToastData>();

function ToastList() {
  const { toasts } = Toast.useToastManager<ToastData>();
  return toasts.map((toast) => {
    const kind = toast.type ?? "info";
    const data = toast.data ?? {};
    return (
      <Toast.Root key={toast.id} toast={toast} className="toast" data-kind={kind} role={kind === "error" ? "alert" : "status"}>
        <Toast.Content className="toast-content">
          <span className={`toast-icon ${kind}`}>
            {kind === "progress" && <Spinner size={14} />}
            {kind === "success" && <Check size={14} stroke={2} />}
            {kind === "error" && <AlertCircle size={14} />}
                      </span>
          <div className="toast-body">
            <Toast.Title className="toast-title" />
            <Toast.Description className="toast-desc" />
            {kind === "progress" && (
              <div className="progress" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.percent ?? 0}>
                <div style={{ width: `${data.percent ?? 0}%` }} />
              </div>
            )}
            {kind === "error" && (
              <div className="toast-actions">
                <Button compact onClick={data.onRetry}>
                  Try again
                </Button>
                <Toast.Close render={<Button compact variant="ghost" />}>Close</Toast.Close>
              </div>
            )}
          </div>
          {kind === "progress" && data.onCancel && (
            <Button compact variant="ghost" onClick={data.onCancel}>
              Cancel
            </Button>
          )}
          {(kind === "success" || kind === "info") && (
            <Toast.Close render={<IconButton small label="Dismiss" />}>
              <Close size={12} />
            </Toast.Close>
          )}
        </Toast.Content>
      </Toast.Root>
    );
  });
}

export function ToastHost({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider toastManager={toastManager} limit={4}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="toast-viewport">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
