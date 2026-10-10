import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ListeningProvider } from "@/components/listening-provider";
import AppShell from "@/components/navigation/app-shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SoundSight",
  description:
    "Sound awareness, live captions, and type-to-speak for Deaf and hard-of-hearing users.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ListeningProvider>
          <AppShell>{children}</AppShell>
        </ListeningProvider>
      </body>
    </html>
  );
}
