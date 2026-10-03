import { AudioLines, Asterisk, Fingerprint, Plus } from "lucide-react";
import { Button, Label, Reel, Profile, Tags, Overlap } from "@/components/ui";
import { compatibility } from "@/lib/data";
import { Reveal } from "@/components/motion";
export default function Home() {
  return (
    <main id="main">
      <section className="hero wrap">
        <div className="hero-copy">
          <Reveal>
            <Label>
              <span className="tiny-star">✳</span> A NEW KIND OF SOCIAL
              CHEMISTRY
            </Label>
            <h1>
              Your algorithm
              <br />
              knows you.
              <br />
              <span>
                Your friends
                <br />
                should too.
              </span>
            </h1>
            <p>
              Your feed says more about you than your bio ever could. Discover
              your digital taste and find people who scroll like you.
            </p>
            <div className="hero-actions">
              <Button href="/connect">Discover your vibe</Button>
              <a className="text-link" href="#how-it-works">
                Explore the concept <Plus size={16} />
              </a>
            </div>
            <div className="hero-note">
              <span className="mini-avatars">
                <i>A</i>
                <i>J</i>
              </span>
              <span>Different people. Same side of the internet.</span>
            </div>
          </Reveal>
        </div>
        <Reveal className="hero-visual" delay={0.15}>
          <div className="visual-index">FIG. 01 — A SHARED FREQUENCY</div>
          <div className="visual-grid" />
          <div className="floating-label label-you">
            YOU <span>01</span>
          </div>
          <div className="hero-reel reel-one">
            <Reel index={0} />
          </div>
          <div className="hero-reel reel-two">
            <Reel index={1} />
          </div>
          <div className="floating-label label-them">
            THEM <span>02</span>
          </div>
          <div className="overlap-ticket">
            <AudioLines size={28} />
            <div>
              <strong>Same wavelength.</strong>
              <span>Different For You pages.</span>
            </div>
            <span className="ticket-star">✳</span>
          </div>
          <div className="visual-bottom">
            <span>FORMULA 1</span>
            <Plus size={12} />
            <span>LATE-NIGHT PLAYLISTS</span>
          </div>
        </Reveal>
      </section>
      <div className="culture-strip">
        <div className="wrap">
          <span>YOU ARE WHAT YOU SCROLL.</span>
          <Asterisk />
          <span>NICHE IS THE NEW NORMAL.</span>
          <Asterisk />
          <span>FIND YOUR KIND OF WEIRD.</span>
          <Asterisk />
        </div>
      </div>
      <section id="how-it-works" className="how wrap">
        <Reveal className="section-intro">
          <Label>THE IDEA IS SIMPLE</Label>
          <h2>
            Less “what do you do?”
            <br />
            More “you’re into that too?”
          </h2>
          <p>
            A bio tells people who you are.
            <br />
            Your feed shows them.
          </p>
        </Reveal>
        <Reveal className="editorial-row">
          <div className="step-number">
            01<span>/</span>
          </div>
          <div className="step-copy">
            <Label>THE DIGITAL FINGERPRINT</Label>
            <h3>
              Your feed,
              <br />
              decoded.
            </h3>
            <p>
              The race recaps. The obscure music. The oddly specific rabbit
              holes. Your little corner of the internet says a lot about you.
            </p>
          </div>
          <div className="fingerprint-visual">
            <Fingerprint size={120} strokeWidth={0.7} />
            <div className="finger-tags">
              <span>Formula 1</span>
              <span>Music</span>
              <span>Technology</span>
              <span>+ a little chaos</span>
            </div>
            <span className="eyebrow">NO TWO FEEDS ARE THE SAME.</span>
          </div>
        </Reveal>
        <Reveal className="editorial-row">
          <div className="step-number">
            02<span>/</span>
          </div>
          <div className="step-copy">
            <Label>A FAMILIAR KIND OF DIFFERENT</Label>
            <h3>
              Find your
              <br />
              people.
            </h3>
            <p>
              Somewhere out there, someone is saving the same edits and laughing
              at the same niche references. That’s a pretty good place to start.
            </p>
          </div>
          <Overlap />
        </Reveal>
        <Reveal className="editorial-row">
          <div className="step-number">
            03<span>/</span>
          </div>
          <div className="step-copy">
            <Label>CONNECTION, WITH CONTEXT</Label>
            <h3>
              Beyond the
              <br />
              percentage.
            </h3>
            <p>
              Shared obsessions. Unexpected differences. The kind of
              conversation starters that skip the small talk and get to the good
              stuff.
            </p>
          </div>
          <div className="conversation-card">
            <span className="eyebrow">YOUR NEXT CONVERSATION, SORTED.</span>
            <span className="quote-mark">“</span>
            <p>
              Okay, but which F1 driver
              <br />
              has the best music taste?
            </p>
            <div>
              <AudioLines size={16} />
              <span>A shared interest. An easy opener.</span>
            </div>
          </div>
        </Reveal>
      </section>
      <section id="experience" className="experience">
        <div className="wrap experience-grid">
          <Reveal className="experience-copy">
            <Label>A GLIMPSE OF THE EXPERIENCE</Label>
            <h2>
              Not a match.
              <br />
              An overlap.
            </h2>
            <p>
              You don’t have to be the same person to be on the same wavelength.
            </p>
            <Button href="/match" secondary>
              Explore the demo
            </Button>
            <span className="demo-note">
              Fictional people. Illustrative results. Real possibilities.
            </span>
          </Reveal>
          <Reveal className="match-preview">
            <div className="preview-top">
              <Label>THE VIBE CHECK</Label>
              <span className="preview-badge">ILLUSTRATIVE PREVIEW</span>
            </div>
            <div className="preview-profiles">
              <Profile compact />
              <span className="profile-plus">+</span>
              <Profile person="jamie" compact />
            </div>
            <div className="preview-score">
              {compatibility.score}
              <span>%</span>
              <div>
                Different feeds.
                <br />
                <strong>A lot in common.</strong>
              </div>
            </div>
            <div className="preview-bottom">
              <Label>YOUR COMMON GROUND</Label>
              <Tags items={["Formula 1", "Music", "Late-night rabbit holes"]} />
            </div>
          </Reveal>
        </div>
      </section>
      <section className="closing wrap">
        <Reveal>
          <Label>THE INTERNET IS SMALLER THAN YOU THINK.</Label>
          <h2>
            Same algorithm.
            <br />
            Different people.
            <br />
            <span>Find your overlap.</span>
          </h2>
          <Button href="/connect">Get started</Button>
        </Reveal>
        <Asterisk className="closing-star" strokeWidth={1} />
      </section>
    </main>
  );
}
