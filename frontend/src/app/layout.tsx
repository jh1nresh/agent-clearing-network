import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { WalletProviderWrapper } from "@/components/WalletProviderWrapper";
import { DarkModeProvider } from "./DarkModeContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "700", "900"],
});

export const metadata: Metadata = {
  title: "Agent Reputation Clearing Network",
  description:
    "Stripe for AI agents — the missing settlement layer for the agentic economy.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} ${playfair.variable}`}>
      <body className="font-sans" suppressHydrationWarning>
        <DarkModeProvider>
          <WalletProviderWrapper>{children}</WalletProviderWrapper>
        </DarkModeProvider>
      </body>
    </html>
  );
}
