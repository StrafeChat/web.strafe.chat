import { createContext, createSignal, For, JSX, useContext } from "solid-js";
import { Portal } from "solid-js/web";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export function ToastProvider(props: { children: JSX.Element; usePortal?: boolean }) {
  const [toasts, setToasts] = createSignal<Toast[]>([]);
  let toastId = 0;

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const showToast = (message: string, type: ToastType = "info") => {
    const id = toastId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 3000); // Remove after 3 seconds
  };

  const ToastContainer = () => (
    <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
      <For each={toasts()}>
        {(toast) => (
          <div
            class={`rounded-lg px-4 py-3 shadow-lg transform transition-all duration-300 ease-in-out
              ${
                toast.type === "success"
                  ? "bg-green-500 text-white"
                  : toast.type === "error"
                  ? "bg-red-500 text-white"
                  : "bg-blue-500 text-white"
              }`}
            style={{
              animation: "slideIn 0.3s ease-out",
            }}
          >
            {toast.message}
          </div>
        )}
      </For>
    </div>
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {props.children}
      {props.usePortal !== false ? (
        <Portal>
          <ToastContainer />
        </Portal>
      ) : (
        <ToastContainer />
      )}
    </ToastContext.Provider>
  );
}

// Add this to your global CSS file
const style = document.createElement("style");
style.textContent = `
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
`;
document.head.appendChild(style);
