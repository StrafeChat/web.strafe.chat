import { useModal } from "../providers/modal/ModalProvider";
import LinkConfirmModal from "../../components/modals/LinkConfirmModal";
import { Component, JSX } from "solid-js";

declare global {
  interface Window {
    handleMarkdownLink: (element: HTMLAnchorElement) => void;
  }
}

export function setupLinkHandler() {
//   const { openModal, closeModal } = useModal();

  window.handleMarkdownLink = (element: HTMLAnchorElement) => {
    const href = element.getAttribute("data-href");
    if (!href) return;

    // Sanitize the URL to prevent malicious links
    try {
      new URL(href);
    } catch {
      console.error("Invalid URL:", href);
      return;
    }

    // Only allow http/https protocols
    if (!href.startsWith("http://") && !href.startsWith("https://")) {
      console.error("Invalid protocol:", href);
      return;
    }
  };
}