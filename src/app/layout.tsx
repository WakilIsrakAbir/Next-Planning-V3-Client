import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_NAME = "Textile Planning Solution";
const APP_DESCRIPTION =
  "Textile Planning Solution (Next Planning V3): department production planning, plan vs actual tracking, reports, load calculation and batch planning.";

export const metadata: Metadata = {
  metadataBase: new URL("https://next-planning-v3-client.vercel.app"),
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  authors: [{ name: "Wakil Israk Abir", url: "https://www.linkedin.com/in/wakil-israk-abir/" }],
  creator: "Wakil Israk Abir",
  // Internal tool: keep it out of search engines.
  robots: { index: false, follow: false },
  openGraph: { type: "website", siteName: APP_NAME, title: APP_NAME, description: APP_DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
