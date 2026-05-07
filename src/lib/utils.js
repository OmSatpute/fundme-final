import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const checkExtensionInstalled = () => {
  return new Promise((resolve) => {
    // 1. Immediate check for global flags or DOM attributes
    if (
      window.__FUNDME_EXTENSION_INSTALLED__ || 
      document.documentElement.hasAttribute('data-fundme-extension-installed') ||
      document.body.hasAttribute('data-fundme-extension-installed')
    ) {
      return resolve(true);
    }
    
    // 2. Multi-attempt handshake
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      window.postMessage({ type: "FUNDME_EXTENSION_PING", source: "fundme-web" }, "*");
      
      if (attempts >= 5) {
        clearInterval(interval);
      }
    }, 200);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      window.removeEventListener("message", onMessage);
      // Final check of flags
      const found = !!(
        window.__FUNDME_EXTENSION_INSTALLED__ || 
        document.documentElement.hasAttribute('data-fundme-extension-installed')
      );
      resolve(found);
    }, 1500);

    const onMessage = (event) => {
      // Support various response formats
      if (
        event.data?.type === "FUNDME_EXTENSION_PONG" || 
        event.data?.source === "fundme-extension" ||
        event.data?.fundme_installed === true
      ) {
        clearInterval(interval);
        clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        resolve(true);
      }
    };

    window.addEventListener("message", onMessage);
  });
};
