import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "APEX — Driver Pace Analyser",
  description:
    "Decomposing seven seasons of Formula 1 lap times into pure driver skill "
    + "versus car performance. A two-way effects model, identified by the "
    + "teammate network.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <script
          src="https://cdn.jsdelivr.net/gh/poggey/built-by@main/built-by.js"
          data-name="Padraig Middleton"
          data-github="https://github.com/poggey"
          defer
        ></script>
      </body>
    </html>
  );
}
