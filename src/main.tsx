import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

const root = document.getElementById("root")!;

/**
 * Load the app, and show why if it will not load.
 *
 * `data.ts` throws on purpose when the season files disagree, and that message
 * names the exact file and contradiction. It throws while the module graph is
 * still evaluating, though, which is before React exists: the ErrorBoundary
 * inside the app cannot catch it and the reader gets a white page with the
 * explanation buried in the console.
 *
 * So the import is dynamic and the failure is rendered by hand. This is the
 * only place in the app that writes HTML directly, which is why the message is
 * escaped rather than interpolated.
 */
function showFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const escaped = message.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);

  root.innerHTML = `
    <main style="max-width:48rem;margin:0 auto;padding:4rem 1.25rem;font-family:ui-sans-serif,system-ui,sans-serif">
      <h1 style="font-size:1.5rem;font-weight:600;letter-spacing:-0.02em">The site could not start</h1>
      <p style="margin-top:0.5rem;line-height:1.7;opacity:0.7">
        It refused rather than show you something that might be untrue. The message below says which
        file and which record.
      </p>
      <pre style="margin-top:1.25rem;padding:1rem;border:1px solid rgba(128,128,128,0.35);border-radius:0.5rem;
                  background:rgba(128,128,128,0.08);white-space:pre-wrap;font-size:0.8rem;line-height:1.6;
                  overflow-x:auto">${escaped}</pre>
    </main>`;
}

try {
  const { default: App } = await import("./App");
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
} catch (error) {
  showFailure(error);
  throw error;
}
