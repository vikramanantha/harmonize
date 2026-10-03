"use client";
import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Brand, Button } from "./ui";
export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <header className="header">
      <nav className="nav wrap" aria-label="Main navigation">
        <Brand />
        <div className="desktop-nav">
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#experience">The experience</Link>
          <Link
            href="/vibe"
            aria-current={pathname === "/vibe" ? "page" : undefined}
          >
            Explore
          </Link>
        </div>
        <div className="nav-end">
          <Button href="/connect">Get started</Button>
          <button
            className="menu-toggle"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </nav>
      {open && (
        <nav
          id="mobile-menu"
          className="mobile-nav"
          aria-label="Mobile navigation"
          onClick={() => setOpen(false)}
        >
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#experience">The experience</Link>
          <Link href="/vibe">Explore the demo</Link>
        </nav>
      )}
    </header>
  );
}
