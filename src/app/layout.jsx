import '../index.css';
import 'leaflet/dist/leaflet.css';


export const metadata = {
  title: "NOCR | Network Operations Center",
  description: "MikroTik Network Operations Center Dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        {/* Google Fonts Inter */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        {/* FontAwesome Icons for Leaflet Markers */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        {/* Favicon */}
        <link rel="icon" type="image/png" href="/logo.png" />
      </head>
      <body className="bg-slate-900 text-slate-50 overflow-hidden antialiased">
        {children}
      </body>
    </html>
  );
}
