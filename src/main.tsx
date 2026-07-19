import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "./lib/pwa/registerSW";

createRoot(document.getElementById("root")!).render(<App />);

void registerSW();
