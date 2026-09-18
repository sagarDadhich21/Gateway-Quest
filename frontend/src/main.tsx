import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { IconSprite } from "./components/IconSprite";
import { ModalProvider } from "./components/modal/ModalContext";
import { ToastProvider } from "./components/toast/ToastContext";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <IconSprite />
    <ToastProvider>
      <ModalProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ModalProvider>
    </ToastProvider>
  </React.StrictMode>
);
