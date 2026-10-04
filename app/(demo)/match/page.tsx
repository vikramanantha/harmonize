import type { Metadata } from "next";
import { AudioLines, MessageCircle } from "lucide-react";
import { Label, Profile, Tags, Comparison, Button } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { starters, compatibility } from "@/lib/data";
export const metadata: Metadata = { title: "Your overlap" };
export default function Match() {
  return (
    <main id="main" className="wrap match-page">
      <div className="page-top">
        <Label>THE VIBE CHECK / ALEX + JAMIE</Label>
        <span className="preview-badge">
          ILLUSTRATIVE PREVIEW · STATIC EXAMPLE
        </span>
      </div>
      <Reveal className="match-heading">
        <Label>TWO FEEDS. ONE FREQUENCY.</Label>
        <h1>
          There’s something
          <br />
          <span>in the overlap.</span>
        </h1>
      </Reveal>
      <Reveal className="match-center" delay={0.15}>
        <div className="match-person">
          <Profile />
          <p>
            Race weekends &<br />
            technology rabbit holes.
          </p>
          <Tags items={["Formula 1", "Technology", "Gaming"]} />
        </div>
        <div className="score-orbits">
          <div className="score-ring first" />
          <div className="score-ring second" />
          <div className="big-score">
            {compatibility.score}
            <span>%</span>
          </div>
          <span className="eyebrow">ON THE SAME WAVELENGTH</span>
        </div>
        <div className="match-person">
          <Profile person="jamie" />
          <p>
            Perfect playlists &<br />a good eye for design.
          </p>
          <Tags items={["Formula 1", "Music", "Fashion"]} />
        </div>
      </Reveal>
      <div className="match-caption">
        <AudioLines size={18} />
        <p>{compatibility.summary}</p>
      </div>
      <section className="match-details">
        <Reveal>
          <Label>01 / YOUR COMMON GROUND</Label>
          <h2>
            The same kind
            <br />
            of obsessed.
          </h2>
          <Tags items={compatibility.shared} />
          <p>
            Race-day edits, playlists for every mood, and a saved folder of
            places to eat. You already have a few things to talk about.
          </p>
          <div className="difference">
            <Label>A LITTLE DIFFERENCE IS A GOOD THING.</Label>
            <h3>New worlds to trade.</h3>
            <p>
              Alex brings technology and gaming. Jamie brings fashion and
              design. Consider it a fresh perspective for each of your feeds.
            </p>
          </div>
        </Reveal>
        <Reveal className="comparison-panel">
          <Label>02 / SIDE BY SIDE</Label>
          <h3>
            Similar taste.
            <br />
            Different proportions.
          </h3>
          <Comparison />
        </Reveal>
      </section>
      <section className="starters">
        <div className="section-top">
          <div>
            <Label>03 / SKIP THE SMALL TALK</Label>
            <h2>Start somewhere good.</h2>
          </div>
          <MessageCircle size={32} strokeWidth={1} />
        </div>
        {starters.map((s, i) => (
          <Reveal className="starter" key={s}>
            <span>0{i + 1}</span>
            <p>{s}</p>
            <span className="starter-interest">
              {["FORMULA 1", "MUSIC", "DIGITAL CULTURE"][i]}
            </span>
          </Reveal>
        ))}
      </section>
      <div className="match-disclaimer">
        This is a fictional example with a fixed 84% score. No accounts were
        connected and no compatibility was calculated.
      </div>
      <section className="profile-cta">
        <div>
          <Label>YOUR PEOPLE ARE OUT THERE.</Label>
          <h2>Curious about your own overlap?</h2>
        </div>
        <Button href="/connect">Discover your vibe</Button>
      </section>
    </main>
  );
}
