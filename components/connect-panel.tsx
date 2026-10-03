"use client";
import { useState } from "react";
import { Camera, LockKeyhole, Check } from "lucide-react";
import { Button } from "./ui";
export function ConnectPanel() {
  const [soon, setSoon] = useState(false);
  return (
    <div className="connect-panel">
      <div className="instagram-icon">
        <Camera size={36} />
      </div>
      <span className="eyebrow">YOUR FEED. YOUR FINGERPRINT.</span>
      <h2>
        A new way to
        <br />
        read the room.
      </h2>
      <p>Start with the things that stop your scroll.</p>
      <button className="button full" onClick={() => setSoon(true)}>
        {soon ? <Check size={18} /> : <Camera size={18} />}{" "}
        {soon ? "Coming soon" : "Connect Instagram"}
      </button>
      <div className="connection-status" role="status">
        {soon
          ? "Instagram connection is coming soon. Explore the fictional demo below."
          : "Instagram integration is coming soon."}
      </div>
      <div className="or">
        <span />
        IN THE MEANTIME
        <span />
      </div>
      <Button href="/vibe" secondary>
        Explore demo
      </Button>
      <p className="privacy">
        <LockKeyhole size={16} />
        This prototype does not access your account, messages, or personal data.
      </p>
    </div>
  );
}
