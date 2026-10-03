import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/ui";
import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist/700.css";
import "@fontsource/geist/900.css";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "VibeCheck — Find your overlap.",
    template: "%s · VibeCheck",
  },
  description:
    "Your feed says more about you than your bio ever could. Discover your digital taste and find people who scroll like you.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
