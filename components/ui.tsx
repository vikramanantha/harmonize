import Link from "next/link";
import { AudioLines, Play, ScanLine } from "lucide-react";
import { profiles, reels, categories } from "@/lib/data";
import type { ReactNode } from "react";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="VibeCheck home">
      <AudioLines size={25} strokeWidth={2.5} />
      vibecheck<span className="brand-period">®</span>
    </Link>
  );
}
export function Button({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link href={href} className={`button ${secondary ? "secondary" : ""}`}>
      {children}
    </Link>
  );
}
export function Label({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}
export function Tags({ items }: { items: readonly string[] }) {
  return (
    <div className="tags">
      {items.map((item) => (
        <span className="tag" key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}
export function Profile({
  person = "alex",
  compact = false,
}: {
  person?: keyof typeof profiles;
  compact?: boolean;
}) {
  const p = profiles[person];
  return (
    <div className={`profile ${compact ? "compact" : ""}`}>
      <span className={`avatar ${p.color}`}>{p.initials}</span>
      <div>
        <strong>{p.name}</strong>
        <span>{p.handle}</span>
      </div>
    </div>
  );
}
export function Reel({
  index,
  small = false,
}: {
  index: number;
  small?: boolean;
}) {
  const reel = reels[index];
  return (
    <div
      className={`reel ${reel.className} ${small ? "small" : ""}`}
      aria-label={`${reel.category}: ${reel.title}, illustrative Reel cover`}
    >
      <div className="reel-top">
        <span>{reel.category}</span>
        <ScanLine size={16} />
      </div>
      <div className="reel-art" aria-hidden="true">
        {index === 1 ? (
          <div className="record" />
        ) : index === 2 ? (
          <div className="pixel-grid">
            {Array.from({ length: 25 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        ) : null}
        <strong>{reel.title}</strong>
      </div>
      <div className="reel-bottom">
        <span>{reel.subtitle}</span>
        <span>
          <Play size={11} fill="currentColor" />
          {reel.duration}
        </span>
      </div>
    </div>
  );
}
export function Overlap({ large = false }: { large?: boolean }) {
  return (
    <div
      className={`overlap ${large ? "large" : ""}`}
      role="img"
      aria-label="Two distinct interests overlapping through Formula 1 and music"
    >
      <div className="orbit left">
        <span>
          YOUR
          <br />
          WORLD
        </span>
      </div>
      <div className="orbit right">
        <span>
          THEIR
          <br />
          WORLD
        </span>
      </div>
      <div className="intersection">
        <AudioLines size={30} />
        <span>THE OVERLAP</span>
      </div>
    </div>
  );
}
export function Comparison() {
  return (
    <div className="comparison">
      <div className="compare-legend">
        <span>
          <i />
          Alex
        </span>
        <span>
          <i />
          Jamie
        </span>
        <span>Illustrative interests / 100</span>
      </div>
      {categories.map((c) => (
        <div className="compare-row" key={c.name}>
          <span>{c.name}</span>
          <div className="compare-tracks">
            <div style={{ width: `${c.alex}%` }} />
            <div style={{ width: `${c.jamie}%` }} />
          </div>
          <span className="sr-only">
            Alex {c.alex}, Jamie {c.jamie}
          </span>
        </div>
      ))}
    </div>
  );
}
export function Footer() {
  return (
    <footer className="footer wrap">
      <Brand />
      <span>A little less small talk. A little more you.</span>
      <span>Made for MHacks · 2026</span>
    </footer>
  );
}
