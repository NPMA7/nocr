(function() {
  try {
    var raw = localStorage.getItem('nocr_custom_theme');
    var theme = raw ? JSON.parse(raw) : {
      id: "blue-nocr",
      name: "Blue NOCR",
      category: "dark",
      bg: "#0F172A",
      card: "#1E293B",
      header: "#1E293B",
      text: "#F8FAFC",
      muted: "#94A3B8",
      border: "#334155",
      primary: "#3B82F6",
      success: "#10B981",
      warning: "#F59E0B",
      danger: "#EF4444",
      purple: "#8B5CF6",
      tagOpd: "#A855F7",
      tagDesa: "#3B82F6"
    };
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
      document.documentElement.style.setProperty('--color-app-bg', theme.bg || '#0F172A');
      document.documentElement.style.setProperty('--color-card-bg', theme.card || '#1E293B');
      document.documentElement.style.setProperty('--color-header-bg', theme.header || theme.card || '#1E293B');
      document.documentElement.style.setProperty('--color-border-main', theme.border || '#334155');
      document.documentElement.style.setProperty('--color-text-main', theme.text || '#F8FAFC');
      document.documentElement.style.setProperty('--color-text-muted', theme.muted || '#94A3B8');
      document.documentElement.style.setProperty('--color-primary', theme.primary || '#3B82F6');
      document.documentElement.style.setProperty('--color-success', theme.success || '#10B981');
      document.documentElement.style.setProperty('--color-warning', theme.warning || '#F59E0B');
      document.documentElement.style.setProperty('--color-danger', theme.danger || '#EF4444');
      document.documentElement.style.setProperty('--color-purple', theme.purple || '#8B5CF6');
      document.documentElement.style.setProperty('--color-tag-opd', theme.tagOpd || theme.purple || '#A855F7');
      document.documentElement.style.setProperty('--color-tag-desa', theme.tagDesa || theme.primary || '#3B82F6');
    }
  } catch(e) {}
})();
