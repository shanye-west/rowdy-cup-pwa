// src/components/Layout.tsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

type LayoutProps = {
  title: string;
  series?: string; // "rowdyCup" | "christmasClassic"
  showBack?: boolean;
  children: React.ReactNode;
};

export default function Layout({ title, series, showBack, children }: LayoutProps) {
  const navigate = useNavigate();

  // --- THEME ENGINE ---
  useEffect(() => {
    // If the series is Christmas Classic, add the class. 
    // Otherwise remove it (defaulting to Summer/Rowdy Cup colors).
    if (series === "christmasClassic") {
      document.body.classList.add("theme-christmas");
    } else {
      document.body.classList.remove("theme-christmas");
    }
  }, [series]);

  return (
    <>
      {/* STICKY HEADER */}
      <header className="app-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          {showBack && (
            <button onClick={() => navigate(-1)} className="btn-back" aria-label="Go Back">
              {/* Chevron Left Icon */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <div className="header-title">{title}</div>
        </div>
        
        {/* Placeholder for future menu icon */}
        <div style={{ width: 24 }}></div>
      </header>

      {/* MAIN CONTENT */}
      <main className="app-container">
        {children}
      </main>
    </>
  );
}