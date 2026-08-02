import {
  BentoCard,
  BentoGrid,
  ButtonLink,
  Eyebrow,
  RabbehniMark,
  StatusPill,
} from "@rabbehni/design-system/web";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Design system" };

export default function AdminDesignSystemPage() {
  return (
    <main className="r-protected__content">
      <header className="r-protected__header">
        <div className="admin-showcase-copy">
          <RabbehniMark />
          <Eyebrow>Admin visual foundation</Eyebrow>
          <h2>Quiet confidence, built into every surface.</h2>
          <p>
            Premium minimalism with a disciplined Bento rhythm, subtle acrylic depth and
            white-label-ready semantic tokens.
          </p>
        </div>
        <ButtonLink href="/login" variant="secondary">
          Authentication
        </ButtonLink>
      </header>
      <BentoGrid>
        <BentoCard span="wide" tone="mint">
          <Eyebrow>Semantic color</Eyebrow>
          <div className="r-token-row" aria-label="Brand color tokens">
            {["#2fcf9b", "#59cbd4", "#8d82ff", "#ff8878", "#f4c45e"].map((color) => (
              <span
                className="r-token-swatch"
                key={color}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </BentoCard>
        <BentoCard tone="aqua">
          <Eyebrow>States</Eyebrow>
          <div className="r-token-row">
            <StatusPill>Secure</StatusPill>
            <StatusPill tone="info">Informative</StatusPill>
          </div>
        </BentoCard>
        <BentoCard span="wide" tone="violet">
          <Eyebrow>Modes</Eyebrow>
          <div className="r-mode-grid" aria-label="Theme and direction previews">
            <section className="r-mode-preview" data-theme="light" dir="ltr" lang="en">
              <span className="r-mode-preview__label">Light · LTR</span>
              <strong>Clear hierarchy</strong>
              <span>Readable, calm and precise.</span>
            </section>
            <section className="r-mode-preview" data-theme="dark" dir="rtl" lang="ar">
              <span className="r-mode-preview__label">داكن · RTL</span>
              <strong>وضوح في كل اتجاه</strong>
              <span>واجهة هادئة وسهلة القراءة.</span>
            </section>
          </div>
        </BentoCard>
      </BentoGrid>
    </main>
  );
}
