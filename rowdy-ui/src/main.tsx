import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import "./firebase";
import App from "./App";
import Match from "./routes/Match";
import Round from "./routes/Round";
import Teams from "./routes/Teams"; // <--- IMPORT THIS

const router = createBrowserRouter([
  { path: "/", element: <App /> },
  { path: "/round/:roundId", element: <Round /> },
  { path: "/match/:matchId", element: <Match /> },
  { path: "/teams", element: <Teams /> }, // <--- ADD THIS
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);