(function() {
  try {
    var raw = localStorage.getItem('nocr_custom_theme');
    var defaultTheme = {
      id: "linear-dark",
      name: "Linear Dark",
      category: "dark",
      bg: "#08090A",
      card: "#191D20",
      header: "#08090A",
      text: "#FFFFFF",
      muted: "#9C9DA1",
      border: "#383B3F",
      primary: "#3296FF",
      success: "#10B981",
      warning: "#E4F222",
      danger: "#EB5757",
      purple: "#8B5CF6",
      tagOpd: "#B5B5B5",
      tagDesa: "#02B8CC"
    };
    var theme = defaultTheme;
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          // If old default blue-nocr or previous linear-dark with #6366F1/#3B82F6/#3232FB is stored, migrate to new Linear Dark #3296FF
          if (
            parsed.id === "blue-nocr" ||
            parsed.id === "linear-dark" ||
            parsed.primary === "#3B82F6" ||
            parsed.primary === "#6366F1" ||
            parsed.primary === "#3232FB"
          ) {
            theme = defaultTheme;
            localStorage.setItem('nocr_custom_theme', JSON.stringify(defaultTheme));
          } else {
            theme = parsed;
          }
        }
      } catch(e) {}
    }
    var mode = localStorage.getItem('nocr_theme') || (theme ? theme.category : 'dark');
    if (mode === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    if (theme) {
      document.documentElement.style.setProperty('--color-app-bg', theme.bg || '#08090A');
      document.documentElement.style.setProperty('--color-card-bg', theme.card || '#191D20');
      document.documentElement.style.setProperty('--color-header-bg', theme.header || theme.card || '#08090A');
      document.documentElement.style.setProperty('--color-border-main', theme.border || '#383B3F');
      document.documentElement.style.setProperty('--color-text-main', theme.text || '#FFFFFF');
      document.documentElement.style.setProperty('--color-text-muted', theme.muted || '#9C9DA1');
      document.documentElement.style.setProperty('--color-primary', theme.primary || '#3296FF');
      document.documentElement.style.setProperty('--color-success', theme.success || '#10B981');
      document.documentElement.style.setProperty('--color-warning', theme.warning || '#E4F222');
      document.documentElement.style.setProperty('--color-danger', theme.danger || '#EB5757');
      document.documentElement.style.setProperty('--color-purple', theme.purple || '#8B5CF6');
      document.documentElement.style.setProperty('--color-tag-opd', theme.tagOpd || '#B5B5B5');
      document.documentElement.style.setProperty('--color-tag-desa', theme.tagDesa || '#02B8CC');
    }
  } catch(e) {}
})();
