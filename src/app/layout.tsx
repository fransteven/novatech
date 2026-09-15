import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SearchShortcutProvider } from "@/providers/search-shortcut-provider";
import { ThemeProvider } from "@/providers/theme-provider";

const archivo = Archivo({
  variable: "--font-archivo",
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
      <body className={`${archivo.variable} ${plexMono.variable} antialiased`}>
        <ThemeProvider>
          <SearchShortcutProvider>
            <div className="flex min-h-screen w-full bg-background text-foreground">
              {children}
            </div>
            <Toaster />
          </SearchShortcutProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
