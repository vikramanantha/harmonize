// The earlier VibeCheck web demo (/vibecheck, /connect, /match, /vibe, /muse),
// with its own nav, footer and fonts. Slated for removal; the product is the
// Harmonize phone app, and / is its landing page.
import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/ui";
import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist/700.css";
import "@fontsource/geist/900.css";
import "../globals.css";

export const metadata: Metadata = {
  title: {
    default: "VibeCheck — Find your overlap.",
    template: "%s · VibeCheck",
  },
  description:
    "Your feed says more about you than your bio ever could. Discover your digital taste and find people who scroll like you.",
};

export default function DemoLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Nav />
      {children}
      <Footer />
    </>
  );
}
