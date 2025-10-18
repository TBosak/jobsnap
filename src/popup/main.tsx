import React from "react";
import ReactDOM from "react-dom/client";
import { PopupApp } from "./popup-app";
import "../ui-shared/tailwind.css";
import "../ui-shared/global.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>
);
