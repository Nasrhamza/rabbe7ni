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

export default function MerchantDesignSystemPage() {
  return (
    <main className="r-protected__content">
      <header className="r-protected__header">
        <div>
          <RabbehniMark />
          <Eyebrow>Merchant visual foundation</Eyebrow>
          <h1>Bento rhythm with purposeful glass.</h1>
          <p className="r-muted">
            Moderate Liquid Glass keeps the interface tactile without compromising daily clarity.
          </p>
        </div>
        <ButtonLink href="/login" variant="secondary">
          Authentication
        </ButtonLink>
      </header>
      <BentoGrid>
        <BentoCard span="wide" tone="mint">
          <Eyebrow>Glass hierarchy</Eyebrow>
          <p className="r-demo-label">
            Opaque content anchors, translucent context and deliberate spatial depth.
          </p>
        </BentoCard>
        <BentoCard tone="aqua">
          <Eyebrow>Status language</Eyebrow>
          <StatusPill>Operational</StatusPill>
        </BentoCard>
        <BentoCard span="wide" tone="violet">
          <Eyebrow>Localization</Eyebrow>
          <div className="r-mode-grid" aria-label="Theme and direction previews">
            <section className="r-mode-preview" data-theme="light" dir="ltr" lang="fr">
              <span className="r-mode-preview__label">Clair · LTR</span>
              <strong>Votre espace quotidien</strong>
              <span>Lisible sur chaque appareil.</span>
            </section>
            <section className="r-mode-preview" data-theme="dark" dir="rtl" lang="ar">
              <span className="r-mode-preview__label">داكن · RTL</span>
              <strong>مساحة التاجر</strong>
              <span>تجربة واضحة في كل فرع.</span>
            </section>
          </div>
        </BentoCard>
      </BentoGrid>
    </main>
  );
}
