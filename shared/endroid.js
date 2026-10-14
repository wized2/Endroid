(function () {
  const KEY = "endroid-theme";
  function system() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function apply(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(KEY, t); } catch (_) {}
    document.querySelectorAll("[data-theme-icon]").forEach(function (el) {
      el.setAttribute("data-lucide", t === "dark" ? "sun" : "moon");
    });
    if (window.lucide) window.lucide.createIcons();
  }
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (_) {}
  apply(saved === "dark" || saved === "light" ? saved : system());
  window.endroidToggleTheme = function () {
    var cur = document.documentElement.getAttribute("data-theme") || system();
    apply(cur === "dark" ? "light" : "dark");
  };
  window.endroidOpenDrawer = function () {
    var d = document.getElementById("e-drawer");
    if (d) d.classList.add("open");
  };
  window.endroidCloseDrawer = function () {
    var d = document.getElementById("e-drawer");
    if (d) d.classList.remove("open");
  };
  document.addEventListener("DOMContentLoaded", function () {
    if (window.lucide) window.lucide.createIcons();
  });
})();
