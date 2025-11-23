import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import "./firebase";
import App from "./App";
import Match from "./routes/Match"; // path + casing must match the file

const router = createBrowserRouter([
  { path: "/", element: <App /> }, // App now contains the Leaderboard + Matches
  { path: "/match/:matchId", element: <Match /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);