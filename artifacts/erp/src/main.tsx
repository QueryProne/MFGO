import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/sw.js`).catch((error) => {
      console.warn("[pwa] service worker registration failed", error);
    });
  });
}
