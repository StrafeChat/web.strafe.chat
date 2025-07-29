/* @refresh reload */
import { render } from "solid-js/web";
import "./index.css";
import App from "./App";
import { registerServiceWorker } from "./lib/sw/registerServiceWorker";
import { initConsoleDetector } from "./lib/utils/consoleDetector";

if (import.meta.env.MODE === "production") initConsoleDetector();

const app = () => <App />;
registerServiceWorker().catch(console.error);
render(app, document.getElementById("root") as HTMLElement);
