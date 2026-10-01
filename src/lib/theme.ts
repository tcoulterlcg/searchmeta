export type Theme = "dark" | "light" | "system";

export const THEME_KEY = "sm-theme";

const META = { dark: "#0b0d10", light: "#f4f5f7" };

/** Runs in <head> before paint: applies the saved theme and the matching browser bar color. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="system")t="dark";var d=document.documentElement;d.dataset.theme=t;var l=t==="light"||(t==="system"&&matchMedia("(prefers-color-scheme: light)").matches);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",l?"${META.light}":"${META.dark}");}catch(e){}})();`;

export function applyTheme(t: Theme) {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {}
  document.documentElement.dataset.theme = t;
  const light = t === "light" || (t === "system" && matchMedia("(prefers-color-scheme: light)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", light ? META.light : META.dark);
}
