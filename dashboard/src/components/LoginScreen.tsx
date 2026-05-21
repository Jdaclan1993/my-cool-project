"use client";

import { useState } from "react";

interface LoginScreenProps {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !pin) {
      setError("Both fields are required");
      return;
    }
    if (pin.length !== 6) {
      setError("PIN must be 6 digits");
      return;
    }
    sessionStorage.setItem("dashboard_password", password);
    sessionStorage.setItem("dashboard_pin", pin);
    onLogin();
  };

  return (
    <div style={styles.wrapper}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>Dashboard Login</h1>
        {error && <p style={styles.error}>{error}</p>}
        <label style={styles.label}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            autoComplete="current-password"
          />
        </label>
        <label style={styles.label}>
          PIN (6 digits)
          <input
            type="password"
            value={pin}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              if (v.length <= 6) setPin(v);
            }}
            maxLength={6}
            inputMode="numeric"
            pattern="[0-9]*"
            style={styles.input}
            autoComplete="off"
          />
        </label>
        <button type="submit" style={styles.button}>
          Login
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "#f0f2f5",
    fontFamily: "system-ui, sans-serif",
  },
  card: {
    background: "#fff",
    padding: "2rem",
    borderRadius: 8,
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    width: 320,
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  title: {
    margin: 0,
    fontSize: "1.25rem",
    textAlign: "center",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    fontSize: "0.875rem",
    fontWeight: 600,
  },
  input: {
    padding: "0.5rem",
    borderRadius: 4,
    border: "1px solid #d1d5db",
    fontSize: "1rem",
  },
  button: {
    padding: "0.6rem",
    background: "#1d4ed8",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    fontSize: "1rem",
    cursor: "pointer",
  },
  error: {
    color: "#dc2626",
    fontSize: "0.875rem",
    textAlign: "center",
    margin: 0,
  },
};
