"use client";

import { Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

function safeReturnPath() {
  const value = new URLSearchParams(window.location.search).get("returnTo");
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível entrar.");
      window.location.replace(safeReturnPath());
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Não foi possível entrar.",
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="dashboard-login-page">
      <section className="dashboard-login-card" aria-labelledby="login-title">
        <div className="dashboard-login-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/prefeitura-apucarana.png" alt="Prefeitura de Apucarana" />
          <span aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/idepplan-2026.png" alt="IDEPPLAN" />
        </div>
        <div className="dashboard-login-heading">
          <div className="dashboard-login-icon" aria-hidden="true">
            <LockKeyhole size={24} />
          </div>
          <p>Ambiente institucional</p>
          <h1 id="login-title">Dashboard IDEPPLAN</h1>
          <span>
            Entre com sua credencial interna. Não é necessária uma conta do
            ChatGPT.
          </span>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="dashboard-username">Usuário</label>
          <input
            id="dashboard-username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <label htmlFor="dashboard-password">Senha</label>
          <div className="dashboard-password-field">
            <input
              id="dashboard-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error ? (
            <p className="dashboard-login-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="dashboard-login-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting ? <LoaderCircle className="spin" size={19} /> : null}
            {submitting ? "Entrando…" : "Acessar dashboard"}
          </button>
        </form>
        <footer>Sessão protegida com duração máxima de 8 horas.</footer>
      </section>
    </main>
  );
}
