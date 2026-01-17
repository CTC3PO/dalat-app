import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const siteUrl = "https://dalat.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "dalat.app · Events · People · Memories · Love",
  description: "Discover and organize events in Da Lat",
  openGraph: {
    type: "website",
    siteName: "dalat.app",
  },
  twitter: {
    card: "summary_large_image",
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
