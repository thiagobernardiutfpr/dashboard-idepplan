"use client";

import { Check, Monitor, Moon, Settings, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ThemePreference = "dark" | "light" | "system";

const STORAGE_KEY = "idepplan-dashboard-theme";
const OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof Moon;
}> = [
  {
    value: "dark",
    label: "Escuro",
    description: "Visual institucional original",
    icon: Moon,
  },
  {
    value: "light",
    label: "Claro",
    description: "Mais luminosidade e contraste",
    icon: Sun,
  },
  {
    value: "system",
    label: "Sistema",
    description: "Acompanha este dispositivo",
    icon: Monitor,
  },
];

function resolveTheme(preference: ThemePreference) {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(preference: ThemePreference) {
  document.documentElement.dataset.theme = resolveTheme(preference);
  document.documentElement.dataset.themePreference = preference;
}

function initialPreference(): ThemePreference {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "system" || stored === "dark"
    ? stored
    : "dark";
}

export function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [preference, setPreference] =
    useState<ThemePreference>(initialPreference);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyTheme(preference);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => {
      if (document.documentElement.dataset.themePreference === "system") {
        applyTheme("system");
      }
    };
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, [preference]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function selectTheme(next: ThemePreference) {
    setPreference(next);
    localStorage.setItem(STORAGE_KEY, next);
    setOpen(false);
  }

  return (
    <div className="theme-switcher" ref={containerRef}>
      <button
        type="button"
        className={open ? "theme-trigger active" : "theme-trigger"}
        aria-label="Alterar tema do dashboard"
        aria-expanded={open}
        aria-controls="dashboard-theme-menu"
        title="Alterar tema"
        onClick={() => setOpen((current) => !current)}
      >
        <Settings size={21} />
        <span>Tema</span>
      </button>

      {open ? (
        <div
          id="dashboard-theme-menu"
          className="theme-menu"
          role="dialog"
          aria-label="Tema do dashboard"
        >
          <header>
            <span>Aparência</span>
            <strong>Escolha o tema</strong>
          </header>
          <div className="theme-options" role="radiogroup" aria-label="Temas disponíveis">
            {OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = preference === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={selected ? "selected" : ""}
                  onClick={() => selectTheme(option.value)}
                >
                  <i><Icon size={18} /></i>
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                  {selected ? <Check size={17} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
