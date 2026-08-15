import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Play } from 'lucide-react';
import { useAuthStore } from '@/state/auth.store';
import { authService } from '@/services/auth.service';
import { eventService } from '@/services/event.service';
import { FEATURES, WORK_QUEUE_SHOT } from './landingContent';
import { FaqAccordion } from './components/FaqAccordion';
import { FeatureSection } from './components/FeatureSection';
import { HorizonBackdrop } from './components/HorizonBackdrop';
import { LandingFooter } from './components/LandingFooter';
import { LandingNav } from './components/LandingNav';
import { ProductFrame } from './components/ProductFrame';
import { Reveal } from './components/Reveal';
import { SignalMarquee } from './components/SignalMarquee';
import { StatCounters } from './components/StatCounters';

const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-500 disabled:opacity-60';
const GHOST_BTN =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-surface-400 bg-surface-100 px-5 py-3 text-sm font-medium text-slate-300 transition-colors duration-200 hover:border-surface-500 hover:text-fg';

export default function LandingPage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<{ path: string; message: string } | null>(null);

  useEffect(() => {
    if (user) navigate('/queue', { replace: true });
  }, [user, navigate]);

  useEffect(() => { eventService.track('visitor'); }, []);

  useEffect(() => {
    document.body.classList.add('landing');
    return () => document.body.classList.remove('landing');
  }, []);

  if (user) return null;

  async function openDemo(path: string) {
    setDemoLoading(path);
    setDemoError(null);
    try {
      const { user: u, tokens } = await authService.demoLogin();
      setAuth(u, tokens.accessToken, tokens.refreshToken);
      navigate(path, { replace: true });
    } catch (err) {
      const status = (err as { status?: number })?.status;
      setDemoError({
        path,
        message: status === 429
          ? 'Too many demo sessions from this network in the past hour. Try again shortly, or start a free trial.'
          : 'The demo could not start. Try again, or start a free trial.',
      });
      setDemoLoading(null);
    }
  }

  const heroLoading = demoLoading === '/queue';
  const heroError = demoError?.path === '/queue' ? demoError : null;

  return (
    <div className="min-h-screen bg-surface-0 text-fg">
      <LandingNav />

      <main>
        <section className="relative overflow-hidden pb-24 md:pb-32">
          <div className="relative pb-16 pt-36 md:pb-20 md:pt-44">
            <HorizonBackdrop />

            <div className="relative mx-auto max-w-3xl px-6 text-center">
              <Reveal>
                <span className="inline-flex items-center gap-2.5 rounded-full border border-surface-400 bg-surface-100/70 px-3.5 py-1.5 backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                  <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-slate-400">
                    Commercial real estate operations
                  </span>
                </span>
              </Reveal>

              <Reveal delay={60}>
                <h1 className="landing-display-1 mt-8 text-fg">
                  Every risk.<br />Ranked. Daily.
                </h1>
              </Reveal>

              <Reveal delay={120}>
                <p className="landing-body mx-auto mt-6 max-w-xl text-slate-400">
                  Valence watches every lease, payment, and vacancy in your portfolio, then hands you
                  the one action that clears each one.
                </p>
              </Reveal>

              <Reveal delay={180}>
                <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                  <button type="button" onClick={() => openDemo('/queue')} disabled={heroLoading} className={PRIMARY_BTN}>
                    {heroLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    {heroLoading ? 'Opening demo' : 'Explore live demo'}
                  </button>
                  <Link to="/auth/register" className={GHOST_BTN}>
                    Start free trial
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                {heroError ? (
                  <p role="alert" className="mx-auto mt-5 max-w-sm text-sm leading-6 text-danger">
                    {heroError.message}
                  </p>
                ) : (
                  <p className="mt-5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-slate-500">
                    No account. No card. One click.
                  </p>
                )}
              </Reveal>
            </div>
          </div>

          <Reveal delay={240} className="relative mx-auto mt-10 max-w-[70rem] px-6">
            <ProductFrame
              shot={WORK_QUEUE_SHOT}
              alt="The Valence Work Queue, showing portfolio risks ordered by revenue impact"
              path="/queue"
              priority
              className="mx-auto max-w-4xl"
            />
            <p className="mt-6 text-center font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-slate-500">
              Captured from the running product on the demo portfolio
            </p>
          </Reveal>
        </section>

        <section className="border-y border-surface-400 bg-surface-50 py-14">
          <p className="mb-8 text-center font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-slate-500">
            Monitored continuously across every property
          </p>
          <SignalMarquee />
        </section>

        <div id="product" className="scroll-mt-16 divide-y divide-surface-400">
          {FEATURES.map((f, i) => (
            <FeatureSection
              key={f.id}
              feature={f}
              flip={i % 2 === 1}
              onOpenDemo={openDemo}
              demoLoading={demoLoading}
              demoError={demoError?.path === f.demoPath ? demoError.message : null}
            />
          ))}
        </div>

        <section className="border-t border-surface-400 bg-surface-50 py-24 md:py-32">
          <div className="mx-auto max-w-[70rem] px-6">
            <Reveal className="max-w-2xl">
              <p className="landing-eyebrow text-brand-400">Operating limits</p>
              <h2 className="landing-display-2 mt-4 text-fg">Real numbers. No asterisks.</h2>
              <p className="landing-body mt-5 text-slate-400">
                Every figure below is a value the product enforces, not a marketing estimate.
              </p>
            </Reveal>

            <Reveal delay={80} className="mt-16">
              <StatCounters />
            </Reveal>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 py-24 md:py-32">
          <div className="mx-auto grid max-w-[70rem] gap-12 px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <Reveal>
              <p className="landing-eyebrow text-brand-400">FAQ</p>
              <h2 className="landing-display-2 mt-4 text-fg">Straight answers.</h2>
              <p className="landing-body mt-5 max-w-sm text-slate-400">
                Still unsure after reading? Write to us and a person replies.
              </p>
              <a
                href="mailto:support@valenceos.ca"
                className="group mt-6 inline-flex items-center gap-2 text-sm font-medium text-brand-400 transition-colors duration-200 hover:text-brand-300"
              >
                support@valenceos.ca
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </a>
            </Reveal>

            <Reveal delay={80}>
              <FaqAccordion />
            </Reveal>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-surface-400 py-28 md:py-36">
          <HorizonBackdrop />
          <div className="relative mx-auto max-w-2xl px-6 text-center">
            <Reveal>
              <h2 className="landing-display-2 text-fg">See it. Then decide.</h2>
              <p className="landing-body mx-auto mt-5 max-w-md text-slate-400">
                The demo is the product, running on a full portfolio. Look around before you give us
                anything at all.
              </p>
              <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <button type="button" onClick={() => openDemo('/queue')} disabled={heroLoading} className={PRIMARY_BTN}>
                  {heroLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  {heroLoading ? 'Opening demo' : 'Explore live demo'}
                </button>
                <Link to="/auth/register" className={GHOST_BTN}>
                  Start free trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              {heroError && (
                <p role="alert" className="mx-auto mt-5 max-w-sm text-sm leading-6 text-danger">
                  {heroError.message}
                </p>
              )}
            </Reveal>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
