import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SearchShortcutProvider } from "@/providers/search-shortcut-provider";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: "NovaTech", template: "%s · NovaTech" },
  description: "Operación, inventario y caja para comercio tecnológico.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CO" suppressHydrationWarning>
      <body className={`${plexSans.variable} ${plexMono.variable} antialiased`}>
        <SearchShortcutProvider>
          <div className="flex min-h-screen w-full bg-background text-foreground transition-colors duration-200">
            {children}
          </div>
          <Toaster />
        </SearchShortcutProvider>
      </body>
    </html>
  );
}
