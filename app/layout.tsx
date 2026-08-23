import type { Metadata, Viewport } from "next";
import {
  Anek_Devanagari,
  Archivo_Black,
  Bangers,
  Caveat,
  Noto_Sans_JP,
  Press_Start_2P,
  Zen_Maru_Gothic,
} from "next/font/google";
import "./globals.css";

const zen = Zen_Maru_Gothic({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-zen",
  display: "swap",
});

const archivo = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-archivo",
  display: "swap",
});

const press = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-press",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-caveat",
  display: "swap",
});

const bangers = Bangers({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bangers",
  display: "swap",
});

const anekDeva = Anek_Devanagari({
  subsets: ["devanagari", "latin"],
  variable: "--font-anek-deva",
  display: "swap",
});

const notoJp = Noto_Sans_JP({
  variable: "--font-noto-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Indilingo — a little-planet language journey",
  description: "Choose a destination. Walk the street. Speak their language. The world talks back.",
  applicationName: "Indilingo",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Indilingo",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#7ed0c0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${zen.variable} ${archivo.variable} ${press.variable} ${caveat.variable} ${bangers.variable} ${anekDeva.variable} ${notoJp.variable} h-full`}
    >
      <body className="min-h-full bg-night text-on antialiased">{children}</body>
    </html>
  );
}
