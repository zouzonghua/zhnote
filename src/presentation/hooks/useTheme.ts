import { useState, useEffect } from "react";

export type Theme = "dark" | "light" | "system";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("theme") as Theme) || "system";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    const applyTheme = (currentTheme: Theme) => {
      // Use requestAnimationFrame to ensure we don't block the main thread
      // during the heavy re-render triggered by theme change
      requestAnimationFrame(() => {
        root.classList.remove("light", "dark");

        if (currentTheme === "system") {
          const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
          root.classList.add(systemTheme);
        } else {
          root.classList.add(currentTheme);
        }
      });
    };

    applyTheme(theme);
    localStorage.setItem("theme", theme);

    // Listen for system changes if in system mode
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyTheme("system");
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  return { theme, setTheme };
}
