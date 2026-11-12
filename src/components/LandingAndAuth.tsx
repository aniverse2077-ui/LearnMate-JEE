import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Languages,
  Target,
  ShieldCheck,
  Plus,
  Minus,
  User as UserIcon,
  Mail,
  Lock,
  ArrowLeft,
  Compass,
  Grid,
  Headphones,
} from 'lucide-react';
import { googleSignIn, emailSignIn, emailSignUp } from '../firebase';

export type LegalModalTabId = 'privacy' | 'terms' | 'ai-safety' | 'google-api' | 'contact';

interface LandingPageProps {
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  onOpenLegal: (tab: LegalModalTabId) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth, onOpenLegal }) => {
  const [sampleLang, setSampleLang] = useState<'English' | 'Hinglish'>('English');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [quickQuestion, setQuickQuestion] = useState<string>('');
  const [quickAnswer, setQuickAnswer] = useState<string>('');
  const [quickLoading, setQuickLoading] = useState<boolean>(false);

  const faqs = [
    {
      q: 'How does LearnMate turn my own JEE notes into practice and revision?',
      a: 'Upload your coaching PDFs, handwritten note photos, YouTube lecture links, or Google Docs. Gemini 4 Argon and Carbon extract every formula, concept, and common JEE trap to build custom flashcards, mind maps, and NTA-style CBT mocks.',
    },
    {
      q: 'Why can’t I generate images or videos without signing in?',
      a: 'High-resolution 1K/2K/4K concept visuals (Gemini 3 Pro Image), Nano Banana diagram edits, and Omni Flash animated video lessons are saved privately to your personal student library once you sign in.',
    },
    {
      q: 'How do I report a wrong answer?',
      a: 'Every AI Tutor explanation and CBT Mock solution includes a cited page reference and a verification button so you can cross-check against your textbook or flag steps for deep re-evaluation.',
    },
  ];

  const handleTryQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuestion.trim()) return;
    setQuickLoading(true);
    try {
      const res = await fetch('/api/ai/fast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: quickQuestion,
          language: sampleLang,
          context: 'Landing page JEE sample preview',
        }),
      });
      const data = await res.json();
      setQuickAnswer(data.text || 'Sign in to explore full step-by-step JEE derivations.');
    } catch {
      setQuickAnswer('Sign in to access the full JEE AI Tutor.');
    } finally {
      setQuickLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#0F172A] flex flex-col relative">
      {/* Top Bar matching Screenshot 13 & 14 */}
      <header className="w-full max-w-[1280px] mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#4F46E5] flex items-center justify-center text-white shadow-sm">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-slate-900">
            LearnMate
          </span>
          <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-[#EEF2FF] text-[#4F46E5] tracking-wide">
            JEE
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#how-it-works" className="hover:text-slate-900 transition-colors">
            How it works
          </a>
          <a href="#try-question" className="hover:text-slate-900 transition-colors">
            Try a question
          </a>
          <a href="#faq" className="hover:text-slate-900 transition-colors">
            FAQ
          </a>
          <button
            type="button"
            onClick={() => onOpenAuth('signin')}
            className="font-semibold text-slate-900 hover:text-[#4F46E5] transition-colors cursor-pointer"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => onOpenAuth('signup')}
            className="px-4 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-sm flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <span>Create free account</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </nav>
      </header>

      {/* Hero Section matching Screenshot 13 */}
      <main className="flex-1">
        <section className="max-w-[1280px] mx-auto px-6 pt-12 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EEF2FF] text-[#4F46E5] text-xs font-semibold border border-indigo-100">
                <Sparkles className="w-3.5 h-3.5" />
                JEE Main 2027 · Session 1
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-50 text-slate-600 text-xs font-medium border border-slate-200">
                69 days to JEE Main Session 1
              </span>
            </div>

            <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-[54px] leading-[1.1] tracking-tight text-slate-900">
              Your JEE notes, turned into a tutor that{' '}
              <span className="text-[#4F46E5]">explains, quizzes and revises.</span>
            </h1>

            <p className="text-slate-600 text-base sm:text-lg leading-relaxed max-w-xl">
              Bring your own chapter. Learn it step by step in English or Hinglish, check yourself
              with JEE-style questions, then revise only what you keep getting wrong.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button
                type="button"
                onClick={() => onOpenAuth('signup')}
                className="px-6 py-3.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-sm flex items-center gap-2.5 shadow-sm transition-colors cursor-pointer"
              >
                <span>Create free account</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>No card needed. No ads. Your material stays private to your account.</span>
            </div>
          </div>

          {/* Interactive Sample Card on Right (Conditional Probability) */}
          <div className="lg:col-span-5 relative pb-4">
            <div className="rounded-2xl bg-white border border-slate-200/90 shadow-lg p-6 pb-9 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#4F46E5]">
                  <span>✎ Conditional probability</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium">
                  Page 1
                </span>
              </div>

              <p className="text-sm text-slate-700 leading-relaxed">
                {sampleLang === 'English'
                  ? 'If B has already happened, how likely is A? The sample space shrinks from every outcome to just B.'
                  : 'Agar event B pehle hi ho chuka hai, toh A hone ki probability kya hogi? Sample space shrink hokar sirf B reh jaata hai.'}
              </p>

              <div className="px-4 py-3.5 rounded-xl bg-[#EEF2FF]/70 border border-indigo-100 font-mono text-sm font-semibold text-[#4F46E5]">
                P(A | B) = P(A ∩ B) / P(B)
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {sampleLang === 'English'
                      ? 'Division by the condition, not by P(A).'
                      : 'Hamesha given condition P(B) se divide karein, P(A) se nahi.'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {sampleLang === 'English'
                      ? 'P(A | B) and P(B | A) are different.'
                      : 'P(A | B) aur P(B | A) bilkul alag hote hain.'}
                  </span>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="text-xs font-semibold text-[#4F46E5] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Open the full sample chapter</span>
                  <span>›</span>
                </button>
              </div>
            </div>

            {/* Floating English / Hinglish Toggle Pill */}
            <div className="mt-4 sm:mt-0 sm:absolute sm:-bottom-2 sm:-left-6 bg-white border border-slate-200 shadow-md rounded-xl px-3.5 py-2.5 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Languages className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setSampleLang('English')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    sampleLang === 'English'
                      ? 'font-bold text-slate-900 bg-slate-100'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  English
                </button>
                <span className="text-slate-300">/</span>
                <button
                  type="button"
                  onClick={() => setSampleLang('Hinglish')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    sampleLang === 'Hinglish'
                      ? 'font-bold text-slate-900 bg-slate-100'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Hinglish
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works & Try a Question Section */}
        <section id="how-it-works" className="max-w-[1280px] mx-auto px-6 py-12 border-t border-slate-100">
          <p className="text-[11px] font-bold tracking-widest uppercase text-[#4F46E5] mb-2">
            BUILT FOR JEE MAIN & ADVANCED
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
              <h3 className="font-display font-bold text-base text-slate-900">
                01. Bring your own material
              </h3>
              <p className="text-sm text-slate-600">
                Upload PDFs up to 60 pages, handwritten coaching notes photos, YouTube lectures, or
                import directly from Google Drive and Google Docs.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
              <h3 className="font-display font-bold text-base text-slate-900">
                02. Visualise with 3D, SVG & Video
              </h3>
              <p className="text-sm text-slate-600">
                Turn tricky Free-Body Diagrams, VSEPR complexes, and ray optics into interactive 2D
                SVGs, Three.js 3D models, and Omni Flash animated lessons.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
              <h3 className="font-display font-bold text-base text-slate-900">
                03. NTA CBT Mocks & Mistake DNA
              </h3>
              <p className="text-sm text-slate-600">
                Practice in an authentic NTA CBT exam interface, track focus events, and export
                revision Mind Maps to Google Slides and Keep.
              </p>
            </div>
          </div>
        </section>

        {/* Try a Question Interactive Bar */}
        <section id="try-question" className="max-w-[1280px] mx-auto px-6 py-8">
          <div className="p-6 rounded-2xl bg-[#F8FAFC] border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-display font-bold text-lg text-slate-900">
                Try asking a quick JEE concept question
              </h2>
              <p className="text-xs text-slate-500">
                Powered by low-latency Gemini 3.1 Flash Lite in {sampleLang}.
              </p>
            </div>
            <form onSubmit={handleTryQuestion} className="w-full md:w-auto flex-1 max-w-xl flex gap-2">
              <input
                type="text"
                value={quickQuestion}
                onChange={(e) => setQuickQuestion(e.target.value)}
                placeholder="e.g., Why is Zn not considered a transition element?"
                className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:border-[#4F46E5]"
              />
              <button
                type="submit"
                disabled={quickLoading}
                className="px-4 py-2.5 rounded-xl bg-[#4F46E5] text-white text-sm font-semibold hover:bg-[#4338CA] transition-colors cursor-pointer"
              >
                {quickLoading ? 'Thinking...' : 'Ask'}
              </button>
            </form>
          </div>
          {quickAnswer && (
            <div className="mt-3 p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 text-sm text-slate-800 whitespace-pre-wrap">
              {quickAnswer}
            </div>
          )}
        </section>

        {/* FAQ Section matching Screenshot 14 */}
        <section id="faq" className="max-w-[1280px] mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5">
            <h2 className="font-display font-bold text-2xl text-slate-900">
              Frequently asked questions
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Everything you need to know about privacy, AI capabilities, and JEE exam preparation.
            </p>
          </div>
          <div className="lg:col-span-7 space-y-3">
            {faqs.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-5 py-4 text-left flex items-center justify-between font-semibold text-sm text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span>{item.q}</span>
                  {openFaq === idx ? (
                    <Minus className="w-4 h-4 text-[#4F46E5]" />
                  ) : (
                    <Plus className="w-4 h-4 text-[#4F46E5]" />
                  )}
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Bottom Purple Conversion Banner matching Screenshot 14 */}
        <section className="w-full bg-[#F8FAFC] py-16 px-6 border-t border-slate-100">
          <div className="max-w-[920px] mx-auto rounded-3xl bg-gradient-to-r from-[#3B28CC] via-[#4F46E5] to-[#6D28D9] p-8 sm:p-12 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="space-y-3 max-w-lg">
              <h2 className="font-display font-extrabold text-2xl sm:text-3xl leading-tight">
                Start with one chapter you already have.
              </h2>
              <p className="text-indigo-100 text-sm leading-relaxed">
                Create a free account, add your material and ask your first doubt. Your notes,
                practice and progress stay private to your own account.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 shrink-0 w-full md:w-auto">
              <button
                type="button"
                onClick={() => onOpenAuth('signup')}
                className="px-6 py-3 rounded-xl bg-white text-[#4F46E5] font-bold text-sm flex items-center justify-center gap-2 shadow-sm hover:bg-indigo-50 transition-colors cursor-pointer"
              >
                <span>Create free account</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('signin')}
                className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/25 transition-colors cursor-pointer"
              >
                Sign in to existing account
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Floating Right Quick Dock from Screenshot 13 & 14 */}
      <div className="hidden lg:flex fixed right-3 top-1/2 -translate-y-1/2 flex-col gap-2 z-30">
        <button
          type="button"
          onClick={() => onOpenAuth('signup')}
          title="Study Workbench"
          className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md hover:bg-[#4F46E5] transition-colors cursor-pointer"
        >
          <BookOpen className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onOpenAuth('signup')}
          title="Voice Tutor"
          className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md hover:bg-[#4F46E5] transition-colors cursor-pointer"
        >
          <Headphones className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onOpenAuth('signup')}
          title="Study Tools"
          className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md hover:bg-[#4F46E5] transition-colors cursor-pointer"
        >
          <Grid className="w-4 h-4" />
        </button>
      </div>

      {/* Footer matching Screenshot 14 with interactive Legal & Compliance Center triggers */}
      <footer className="max-w-[1280px] w-full mx-auto px-6 py-10 text-xs text-slate-500 space-y-4">
        <div className="flex flex-wrap items-center gap-6 font-medium text-slate-700">
          <span className="font-display font-bold text-slate-900">LearnMate</span>
          <button
            type="button"
            onClick={() => onOpenLegal('privacy')}
            className="hover:text-[#4F46E5] transition-colors cursor-pointer"
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => onOpenLegal('terms')}
            className="hover:text-[#4F46E5] transition-colors cursor-pointer"
          >
            Terms &amp; Conditions
          </button>
          <button
            type="button"
            onClick={() => onOpenLegal('ai-safety')}
            className="hover:text-[#4F46E5] transition-colors cursor-pointer"
          >
            AI &amp; Safety Policy
          </button>
          <button
            type="button"
            onClick={() => onOpenLegal('google-api')}
            className="hover:text-[#4F46E5] transition-colors cursor-pointer"
          >
            Google API Disclosure
          </button>
          <button
            type="button"
            onClick={() => onOpenLegal('contact')}
            className="hover:text-[#4F46E5] transition-colors cursor-pointer"
          >
            Contact &amp; Report Answer
          </button>
        </div>
        <p className="leading-relaxed max-w-3xl text-[11px] text-slate-400">
          LearnMate is an independent study tool for JEE aspirants. It is not affiliated with the
          National Testing Agency (NTA), IITs or any coaching institute. AI answers can make
          mistakes; always verify important steps against your textbook or teacher. NTA bans
          calculators and all electronic devices in the exam hall.
        </p>
        <p className="text-[11px] text-slate-400">
          © 2026 LearnMate · Built for JEE Main 2027 Session 1 · GDPR &amp; India DPDP Act 2023 Compliant
        </p>
      </footer>
    </div>
  );
};

interface AuthScreenProps {
  initialMode: 'signin' | 'signup';
  onBackToLanding: () => void;
  onAuthComplete: () => void;
  onOpenLegal?: (tab: LegalModalTabId) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  initialMode,
  onBackToLanding,
  onAuthComplete,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const outcome = await googleSignIn(false);
      if (outcome.user) {
        onAuthComplete();
      } else if (outcome.cancelled) {
        setErrorMsg(
          outcome.errorCode === 'auth/popup-blocked'
            ? 'Your browser blocked the sign-in popup. Please allow popups for this site or sign in with your email below.'
            : 'Google Sign-In window was closed before completing. Click "Continue with Google" to try again, or sign in with your email below.'
        );
      } else if (outcome.errorMessage) {
        setErrorMsg(outcome.errorMessage);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google Sign-In could not be completed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email.trim() || password.length < 8) {
      setErrorMsg('Please enter a valid email and a password of at least 8 characters.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        await emailSignUp(name, email, password);
      } else {
        await emailSignIn(email, password);
      }
      onAuthComplete();
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          'Authentication failed. Ensure Email/Password is enabled in your Firebase project or use Continue with Google.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white text-slate-900">
      {/* Left Brand Showcase Panel matching Screenshot 12 */}
      <div className="lg:col-span-6 bg-gradient-to-br from-[#3730A3] via-[#4F46E5] to-[#6D28D9] text-white p-8 sm:p-14 flex flex-col justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-xl">LearnMate</span>
          <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-white/20 text-white">
            JEE
          </span>
        </div>

        <div className="my-12 space-y-6 max-w-lg">
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl leading-tight">
            Turn your own JEE notes into explanations, practice and revision.
          </h1>

          <div className="space-y-4 text-sm text-indigo-100">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <BookOpen className="w-4 h-4" />
              </div>
              <span>Study from your own chapters, coaching modules and notes.</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <Languages className="w-4 h-4" />
              </div>
              <span>Step-by-step explanations in English or Hinglish.</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <Target className="w-4 h-4" />
              </div>
              <span>JEE-style practice and revision made from your material.</span>
            </div>
          </div>

          <div className="pt-2">
            <span className="inline-block px-3.5 py-1.5 rounded-full bg-white/15 border border-white/20 text-xs font-semibold">
              69 days to JEE Main Session 1
            </span>
          </div>
        </div>

        <div className="text-xs text-indigo-200">
          Private per-student encrypted workspace · Powered by Firebase Auth & Firestore
        </div>
      </div>

      {/* Right Auth Form Panel matching Screenshot 12 (with No Demo Button per user instruction) */}
      <div className="lg:col-span-6 p-8 sm:p-14 flex flex-col justify-center max-w-md mx-auto w-full">
        <button
          type="button"
          onClick={onBackToLanding}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 mb-6 cursor-pointer w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to LearnMate</span>
        </button>

        <h2 className="font-display font-bold text-2xl text-slate-900">
          {mode === 'signup' ? 'Create your account' : 'Sign in to your account'}
        </h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          Your notes, practice and progress stay private to your account.
        </p>

        {/* Official Google Sign-In Button */}
        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleLogin}
          className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-3 text-sm font-semibold text-slate-800 transition-colors cursor-pointer shadow-2xs"
        >
          <svg className="w-4 h-4" viewBox="0 0 48 48">
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="relative my-6 flex items-center justify-center">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-white px-3 text-[11px] text-slate-400 whitespace-nowrap">
            or use email
          </span>
          <div className="border-t border-slate-200 w-full" />
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Your name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#4F46E5]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#4F46E5]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters, letters and numbers"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#4F46E5]"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>{mode === 'signup' ? 'Create account' : 'Sign in'}</span>
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-5">
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="font-semibold text-[#4F46E5] hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              New to LearnMate JEE?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="font-semibold text-[#4F46E5] hover:underline cursor-pointer"
              >
                Create account
              </button>
            </>
          )}
        </p>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Each student’s material and results are private to their own account.</span>
        </div>
      </div>
    </div>
  );
};
