import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers"; 
import { runServerInitialization } from "@/lib/server-init";
import Navbar from "@/components/Navbar";
import WebVitalsReporter from "@/components/WebVitalsReporter";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "نسائم ليبيا", 
  description: "متجرك الإلكتروني المتكامل", 
};

// Run the initialization on the server-side
runServerInitialization();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl"> 
      <body className={inter.className}>
        <Providers>
          <WebVitalsReporter />
          <Navbar>
            {children}
          </Navbar>
        </Providers>
      </body>
    </html>
  );
}
