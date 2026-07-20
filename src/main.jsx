import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { storage } from "./storage.js";
import "./index.css";

// Make the localStorage-backed polyfill available as window.storage,
// exactly like the Claude artifact runtime does — so App.jsx doesn't
// need to know or care which environment it's running in.
window.storage = storage;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
