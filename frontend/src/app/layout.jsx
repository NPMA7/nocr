import "../index.css";
import "leaflet/dist/leaflet.css";

export const metadata = {
  metadataBase: new URL("https://www.nocrnetwork.com"),
  title: {
    default: "NOCR | Network Operations Center and Reporting",
    template: "%s | NOCR",
  },
  description:
    "NOCR (Network Operations Center & Reporting) - Platform terpadu untuk monitoring jaringan, pelaporan operasional, dan analisis performa sistem secara real-time.",
  keywords: [
    "NOCR",
    "Network Operations Center",
    "NOCR Network",
    "Monitoring Jaringan",
    "Reporting Dashboard",
  ],
  authors: [{ name: "NOCR Team" }],
  creator: "NOCR",
  publisher: "NOCR Network",
  openGraph: {
    title: "NOCR | Network Operations Center and Reporting",
    description:
      "Platform terpadu untuk monitoring jaringan, pelaporan operasional, dan analisis performa sistem secara real-time.",
    url: "https://www.nocrnetwork.com",
    siteName: "NOCR Network",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "NOCR Logo",
      },
    ],
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NOCR | Network Operations Center and Reporting",
    description:
      "Platform terpadu untuk monitoring jaringan, pelaporan operasional, dan analisis performa sistem secara real-time.",
    images: ["/logo.png"],
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-video-preview": -1,
      "max-image-preview": "none",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
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
        <script src="/theme-init.js" />
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
