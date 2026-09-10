import type { Metadata } from "next";
import Background from "@/components/Background/Background";
import ExampleVideo from "@/components/ExampleVideo/ExampleVideo";
import Footer from "@/components/Footer/Footer";
import Navbar from "@/components/Navbar/Navbar";
import styles from "./ExamplesPage.module.css";

export const metadata: Metadata = {
  title: "Examples | Tarang",
  description:
    "Hear expressive AI voice examples made with Tarang: voice cloning, voice creation, and short-form delivery.",
  alternates: { canonical: "/examples" },
};

const EXAMPLES = [
  {
    title: "Make the delivery yours",
    description:
      "Turn a line into a performance with a voice that holds onto its character, energy, and intent.",
    src: "/examples/expressive-voice-demo.mp4",
    poster: "/examples/expressive-voice-demo-poster.png",
    duration: "0:51",
    type: "Expression",
  },
  {
    title: "A voice with a point of view",
    description:
      "Hear a distinctive voice stay present from the first word to the final beat — natural, clear, and memorable.",
    src: "/examples/voice-clone-demo.mp4",
    poster: "/examples/voice-clone-demo-poster.png",
    duration: "2:16",
    type: "Voice clone",
  },
  {
    title: "Built for the moment",
    description:
      "Create compact, expressive audio for short-form stories, reactions, and every line that needs to land.",
    src: "/examples/short-form-voice-demo.mp4",
    poster: "/examples/short-form-voice-demo-poster.png",
    duration: "1:26",
    type: "Short form",
    portrait: true,
  },
];

export default function ExamplesPage() {
  return (
    <>
      <Background />
      <Navbar />
      <main className={styles.examplesPage}>
        <section className={styles.intro} aria-labelledby="examples-title">
          <h1 id="examples-title" className={styles.title}>
            Clone anyone&apos;s voice. <em>In seconds.</em>
          </h1>
        </section>

        <section className={styles.showcase} id="examples" aria-label="Tarang voice examples">
          <div className={styles.sectionHeader}>
            <p>Listen in</p>
            <span>03 examples</span>
          </div>

          <div className={styles.exampleGrid}>
            {EXAMPLES.map((example, index) => (
              <article
                className={`${styles.exampleCard} ${example.portrait ? styles.portraitCard : ""}`}
                key={example.src}
              >
                <div className={styles.videoFrame}>
                  <ExampleVideo
                    className={styles.video}
                    src={example.src}
                    poster={example.poster}
                    ariaLabel={`${example.title} video example`}
                  />
                  <div className={styles.videoMeta} aria-hidden="true">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <span>{example.duration}</span>
                  </div>
                </div>
                <div className={styles.cardContent}>
                  <p className={styles.type}>{example.type}</p>
                  <h2>{example.title}</h2>
                  <p>{example.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.closing} aria-label="Try Tarang">
          <p>Ready when your words need more feeling.</p>
          <a href={process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}>
            Create with Tarang <span aria-hidden="true">&rarr;</span>
          </a>
        </section>
      </main>
      <Footer />
    </>
  );
}
