import { Component, createSignal, onMount, onCleanup } from "solid-js";
import LinkConfirmModal from "./modals/LinkConfirmModal";

// List of trusted domains that don't need confirmation
const TRUSTED_DOMAINS = [
  "strafe.chat",
  "github.com/StrafeChat",
  "alpha.strafechat.dev",
];

// Key for storing user trusted domains in localStorage
const USER_TRUSTED_DOMAINS_KEY = "sc_trusted_domains";

/**
 * Get user trusted domains from localStorage
 */
const getUserTrustedDomains = (): string[] => {
  try {
    const storedDomains = localStorage.getItem(USER_TRUSTED_DOMAINS_KEY);
    return storedDomains ? JSON.parse(storedDomains) : [];
  } catch (e) {
    console.error("Error retrieving user trusted domains:", e);
    return [];
  }
};

/**
 * Add a domain to user trusted domains
 */
const addUserTrustedDomain = (domain: string): void => {
  try {
    const currentDomains = getUserTrustedDomains();
    if (!currentDomains.includes(domain)) {
      const updatedDomains = [...currentDomains, domain];
      localStorage.setItem(
        USER_TRUSTED_DOMAINS_KEY,
        JSON.stringify(updatedDomains),
      );
    }
  } catch (e) {
    console.error("Error adding user trusted domain:", e);
  }
};

/**
 * Check if a URL is from a trusted domain
 */
const isTrustedDomain = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Check built-in trusted domains
    const isBuiltInTrusted = TRUSTED_DOMAINS.some(
      (domain) =>
        hostname === domain ||
        hostname.endsWith(`.${domain}`) ||
        hostname.includes(domain),
    );

    if (isBuiltInTrusted) {
      return true;
    }

    // Check user trusted domains
    const userTrustedDomains = getUserTrustedDomains();
    return userTrustedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch (e) {
    console.error("Error checking trusted domain:", e);
    return false;
  }
};

/**
 * Extract domain from URL
 */
const getDomainFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    console.error("Error extracting domain:", e);
    return "";
  }
};

/**
 * Component that handles link clicks and shows confirmation modals for external links
 */
const LinkConfirmationHandler: Component = () => {
  const [isModalOpen, setIsModalOpen] = createSignal(false);
  const [activeHref, setActiveHref] = createSignal<string | null>(null);

  const handleLinkClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const link = target.closest("a") as HTMLAnchorElement;

    // Only process if the target is or is inside an anchor tag with href
    if (!link || !link.href) {
      return;
    }

    try {
      const url = new URL(link.href);

      // Check if it's an external link (different origin)
      const isExternal = url.origin !== window.location.origin;

      if (isExternal) {
        // For external links, prevent default behavior
        event.preventDefault();

        // If ctrl key (or metaKey for Mac) is pressed or it's a trusted domain, open directly
        if (event.ctrlKey || event.metaKey || isTrustedDomain(link.href)) {
          window.open(link.href, "_blank", "noopener,noreferrer");
          return;
        }

        // If modal is already open, don't open another one
        if (isModalOpen()) {
          return;
        }

        // Store the href and open the modal
        setActiveHref(link.href);
        setIsModalOpen(true);
      }
      // For internal links, do nothing and let the default behavior handle it
    } catch (error) {
      console.error("Error handling link click:", error);
    }
  };

  const handleTrustDomain = () => {
    const href = activeHref();
    if (href) {
      const domain = getDomainFromUrl(href);
      if (domain) {
        addUserTrustedDomain(domain);
      }
    }
  };

  onMount(() => {
    // Remove any existing click handlers first
    document.removeEventListener("click", handleLinkClick, { capture: true });

    // Add a global click handler for all links
    document.addEventListener("click", handleLinkClick, { capture: true });

    console.log("LinkConfirmationHandler mounted");
  });

  onCleanup(() => {
    // Clean up the event listener when the component is unmounted
    document.removeEventListener("click", handleLinkClick, { capture: true });

    console.log("LinkConfirmationHandler unmounted");
  });

  return (
    <LinkConfirmModal
      isOpen={isModalOpen()}
      onClose={() => {
        setIsModalOpen(false);
        setActiveHref(null);
      }}
      href={activeHref() || ""}
      onConfirm={() => {
        if (activeHref()) {
          window.open(activeHref() || "", "_blank", "noopener,noreferrer");
        }
      }}
      onTrustDomain={() => {
        handleTrustDomain();
        if (activeHref()) {
          window.open(activeHref() || "", "_blank", "noopener,noreferrer");
        }
        setIsModalOpen(false);
        setActiveHref(null);
      }}
    />
  );
};

export default LinkConfirmationHandler;
