import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
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
  title: "Noorcuts Studio",
  description: "Quran recitation video generator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#10b981",
          colorBackground: "#16162a",
          colorInputBackground: "#0f0f20",
          colorInputText: "#ffffff",
          colorText: "#ffffff",
          colorTextOnPrimaryBackground: "#ffffff",
          colorTextSecondary: "#a1a1aa",
          colorDanger: "#ef4444",
          colorSuccess: "#10b981",
          colorWarning: "#f59e0b",
          colorNeutral: "#ffffff",
          borderRadius: "0.5rem",
        },
        layout: {
          socialButtonsVariant: "blockButton",
        },
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      >
        <body suppressHydrationWarning className="h-full overflow-hidden">{children}</body>
      </html>
    </ClerkProvider>
  );
}
