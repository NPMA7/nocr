import "../index.css";
import "leaflet/dist/leaflet.css";

export const metadata = {
  title: "NOCR | Network Operations Center",
  description: "Network Operations Center Dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Google Fonts Inter */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* FontAwesome Icons for Leaflet Markers */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
        {/* Favicon */}
        <link rel="icon" type="image/png" href="/logo.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var raw = localStorage.getItem('nocr_custom_theme');
                  var theme = raw ? JSON.parse(raw) : null;
                  var mode = localStorage.getItem('nocr_theme') || (theme ? theme.category : 'dark');
                  if (mode === 'light') {
                    document.documentElement.classList.add('light');
                    document.documentElement.setAttribute('data-theme', 'light');
                  } else {
                    document.documentElement.classList.add('dark');
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
            `,
          }}
        />
      </head>
      <body
        className="bg-slate-900 text-slate-50 overflow-hidden antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
