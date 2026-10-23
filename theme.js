const themeSwitch = document.getElementById("mode-switch");
const savedTheme = localStorage.getItem("rekap-kas-theme");
const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;

  if (themeSwitch) {
    themeSwitch.checked = theme === "dark";
  }
}

applyTheme(savedTheme || (systemPrefersDark ? "dark" : "light"));

if (themeSwitch) {
  themeSwitch.addEventListener("change", () => {
    const theme = themeSwitch.checked ? "dark" : "light";
    localStorage.setItem("rekap-kas-theme", theme);
    applyTheme(theme);
  });
}

window.addEventListener("storage", (event) => {
  if (event.key === "rekap-kas-theme") {
    applyTheme(event.newValue === "dark" ? "dark" : "light");
  }
});
