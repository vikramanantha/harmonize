import type { Metadata } from "next";
import { Label, Overlap } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { ConnectPanel } from "@/components/connect-panel";
export const metadata: Metadata = { title: "Discover your vibe" };
export default function Connect() {
  return (
    <main id="main" className="wrap connect-page">
      <Reveal className="connect-copy">
        <Label>01 / A LITTLE INTRODUCTION</Label>
        <h1>
          Let’s see what
          <br />
          your algorithm
          <br />
          <span>says about you.</span>
        </h1>
        <p>
          There’s a whole personality between your saved Reels. Let’s find the
          people who get it.
        </p>
        <Overlap />
        <span className="demo-note">A frontend concept, made for MHacks.</span>
      </Reveal>
      <Reveal delay={0.15}>
        <ConnectPanel />
      </Reveal>
    </main>
  );
}
