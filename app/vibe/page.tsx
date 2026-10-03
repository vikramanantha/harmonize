import type { Metadata } from "next";
import { AudioLines } from "lucide-react";
import { Button, Label, Profile, Tags, Reel } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { profiles, categories, reels } from "@/lib/data";
export const metadata: Metadata = { title: "Your digital taste" };
export default function Vibe() {
  return (
    <main id="main" className="wrap vibe-page">
      <div className="page-top">
        <Label>YOUR DIGITAL FINGERPRINT</Label>
        <span className="preview-badge">FICTIONAL DEMO PROFILE</span>
      </div>
      <Reveal className="vibe-heading">
        <div>
          <Profile />
          <h1>
            A curious mind.
            <br />
            <span>A very specific feed.</span>
          </h1>
          <p>{profiles.alex.description}</p>
          <Tags items={profiles.alex.interests} />
        </div>
        <div className="identity-stamp">
          <AudioLines size={64} strokeWidth={1} />
          <span>
            THE CURIOUS
            <br />
            CURATOR
          </span>
          <small>TASTE TYPE / 001</small>
        </div>
      </Reveal>
      <section className="taste-section">
        <div>
          <Label>01 / IN YOUR ORBIT</Label>
          <h2>
            A little bit of this.
            <br />A whole lot of you.
          </h2>
          <p>
            From the starting grid to your next favorite track.
            <br />A fictional snapshot of Alex’s digital taste.
          </p>
        </div>
        <Reveal className="taste-bars">
          {categories.map((c, i) => (
            <div className="taste-row" key={c.name}>
              <span>0{i + 1}</span>
              <div>
                <div className="taste-label">
                  <strong>{c.name}</strong>
                  <span>{c.alex}%</span>
                </div>
                <div className="taste-track">
                  <div style={{ width: `${c.alex}%` }} />
                </div>
              </div>
            </div>
          ))}
        </Reveal>
      </section>
      <section className="reels-section">
        <div className="section-top">
          <div>
            <Label>02 / THE STUFF THAT STOPS YOUR SCROLL</Label>
            <h2>Your side of the internet.</h2>
          </div>
          <span className="demo-note">
            Illustrative Reel covers · No live content
          </span>
        </div>
        <div className="reel-grid">
          {reels.map((r, i) => (
            <Reveal key={r.id} delay={i * 0.06}>
              <Reel index={i} />
            </Reveal>
          ))}
        </div>
      </section>
      <section className="profile-cta">
        <div>
          <Label>THERE’S SOMEONE ON YOUR WAVELENGTH.</Label>
          <h2>See where your worlds meet.</h2>
        </div>
        <Button href="/match">Discover connections</Button>
      </section>
    </main>
  );
}
