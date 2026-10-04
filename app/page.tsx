// Landing page at / (and the server's public URL): just the Harmonize mark,
// the name, and where to get the app and source code.
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <svg className={styles.logo} viewBox="0 0 100 100" role="img" aria-label="Harmonize logo">
        <defs>
          <clipPath id="harmonize-left">
            <circle cx="38" cy="50" r="28" />
          </clipPath>
        </defs>
        <circle cx="38" cy="50" r="28" fill="#fff" fillOpacity="0.5" />
        <circle cx="62" cy="50" r="28" fill="#fff" fillOpacity="0.5" />
        <circle cx="62" cy="50" r="28" fill="#fff" clipPath="url(#harmonize-left)" />
      </svg>
      <h1 className={styles.title}>Harmonize</h1>
      <p className={styles.tagline}>
        Download our app. Check out the{" "}
        <a href="https://github.com/vikramanantha/harmonize">source code</a>
      </p>
    </main>
  );
}
