import React from 'react';
import { useTranslation } from 'react-i18next';

const About: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6">
      <section className="surface-card overflow-hidden bg-[linear-gradient(135deg,_rgba(20,61,46,1),_rgba(8,32,24,0.96))] px-6 py-10 text-white sm:px-10">
        <p className="section-kicker text-primary-200">{t('aboutPage.aboutVaniki')}</p>
        <h1 className="mt-4 max-w-4xl font-heading text-5xl">{t('aboutPage.title')}</h1>
        <p className="mt-5 max-w-3xl text-base font-medium leading-8 text-white/75">{t('aboutPage.story')}</p>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-3">
        {[
          { title: t('aboutPage.pillar1Title'), description: t('aboutPage.pillar1Description') },
          { title: t('aboutPage.pillar2Title'), description: t('aboutPage.pillar2Description') },
          { title: t('aboutPage.pillar3Title'), description: t('aboutPage.pillar3Description') },
        ].map((pillar) => (
          <article key={pillar.title} className="surface-card p-6">
            <p className="section-kicker mb-3">{t('aboutPage.vanikiPromise')}</p>
            <h2 className="text-2xl font-black text-primary-900">{pillar.title}</h2>
            <p className="mt-4 text-sm font-medium leading-7 text-primary-900/65">{pillar.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
};

export default About;
