import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Harmonize",
  description: "Meet people nearby who watch the same reels as you.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
