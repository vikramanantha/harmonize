import type { Metadata } from "next";
import { MuseLogin } from "@/components/muse-login";

export const metadata: Metadata = { title: "Connect Muse" };
export default function MusePage() {
  return <main id="main" className="wrap connect-page">
    <div className="connect-copy"><span className="eyebrow">YOUR AGENT, CONNECTED</span><h1>Meet your<br /><span>Muse.</span></h1><p>Enter your account details and a task. A remote browser handles the login and delivers your prompt.</p></div>
    <MuseLogin />
  </main>;
}
