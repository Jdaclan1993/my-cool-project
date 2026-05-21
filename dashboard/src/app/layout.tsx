"use client";

import { useState, useEffect } from "react";
import LoginScreen from "@/components/LoginScreen";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("dashboard_password") && sessionStorage.getItem("dashboard_pin")) {
      setAuthenticated(true);
    }
    setMounted(true);
  }, []);

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        {!mounted ? null : !authenticated ? (
          <LoginScreen onLogin={() => setAuthenticated(true)} />
        ) : (
          children
        )}
      </body>
    </html>
  );
}
