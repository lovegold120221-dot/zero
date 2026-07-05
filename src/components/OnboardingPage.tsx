import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface OnboardingPageProps {
  onComplete: () => void;
}

const slides = [
  {
    glyph: (
      <svg viewBox="0 0 56 56" fill="none" className="w-full h-full">
        <circle cx="28" cy="28" r="24" stroke="#d0a78b" strokeWidth="1.2" strokeOpacity={0.3} />
        <circle cx="28" cy="28" r="16" stroke="#d0a78b" strokeWidth="1.5" strokeOpacity={0.15} fill="rgba(208,167,139,0.04)" />
        <path d="M28 18v10l7 7" stroke="#d0a78b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="28" cy="28" r="3" fill="#d0a78b" opacity={0.6} />
        <path d="M22 36h12M22 40h8" stroke="#d0a78b" strokeWidth="1.5" strokeLinecap="round" opacity={0.4} />
      </svg>
    ),
    title: 'Voice Intelligence',
    subtitle: 'Beatrice is a premium voice intelligence assistant by Eburon AI.',
  },
  {
    glyph: (
      <svg viewBox="0 0 56 56" fill="none" className="w-full h-full">
        <rect x="10" y="14" width="36" height="28" rx="5" stroke="#d0a78b" strokeWidth="1.2" strokeOpacity={0.3} fill="rgba(208,167,139,0.04)" />
        <path d="M18 24h20M18 30h16M18 36h10" stroke="#d0a78b" strokeWidth="1.8" strokeLinecap="round" opacity={0.6} />
        <path d="M36 38v6M20 38v6" stroke="#d0a78b" strokeWidth="1.2" strokeLinecap="round" opacity={0.4} />
        <path d="M28 4l-4 6h8l-4-6z" fill="#d0a78b" opacity={0.3} />
      </svg>
    ),
    title: 'Smart Integration',
    subtitle: 'Connect Google Workspace and WhatsApp for seamless, secure, hands-free voice operations.',
  },
  {
    glyph: (
      <svg viewBox="0 0 56 56" fill="none" className="w-full h-full">
        <circle cx="28" cy="28" r="22" stroke="#d0a78b" strokeWidth="1.2" strokeOpacity={0.3} fill="rgba(208,167,139,0.04)" />
        <path d="M22 28l4 4 8-8" stroke="#d0a78b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
        <path d="M36 14l3 3-3 3" stroke="#d0a78b" strokeWidth="1.2" strokeLinecap="round" opacity={0.4} />
        <path d="M20 14l-3 3 3 3" stroke="#d0a78b" strokeWidth="1.2" strokeLinecap="round" opacity={0.4} />
      </svg>
    ),
    title: 'Voice Control',
    subtitle: 'Hands-free operation, real-time AI responses, and complete digital freedom.',
  },
];

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [page, setPage] = useState(0);
  const current = slides[page];
  const isLast = page === slides.length - 1;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-[#d0a78b]/[0.06] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-amber-700/[0.05] rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-[400px] z-10 flex flex-col flex-1">
        {/* Top spacer */}
        <div className="flex-1" />

        {/* Header logo */}
        <div className="flex items-center justify-center gap-3 mb-16">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#d0a78b]/20 to-amber-900/30 p-[1px]">
            <div className="w-full h-full rounded-full bg-[#080808] flex items-center justify-center border border-[#d0a78b]/10 overflow-hidden p-1.5">
              <img src="https://eburon.ai/icon-eburon.svg" alt="" className="w-full h-full object-contain" draggable={false} />
            </div>
          </div>
          <span className="text-sm font-light tracking-[0.15em] text-white/40 uppercase font-['SF_Pro_Display',system-ui,sans-serif]">Beatrice</span>
        </div>

        {/* Card area */}
        <div className="flex-1 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.96 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center text-center w-full"
            >
              <div className="w-24 h-24 mb-8">
                {current.glyph}
              </div>
              <h2 className="text-[22px] font-light tracking-wide text-white/85 mb-4 font-['SF_Pro_Display',system-ui,sans-serif]">
                {current.title}
              </h2>
              <p className="text-white/40 text-[15px] leading-relaxed max-w-xs font-['SF_Pro_Text',system-ui,sans-serif] font-normal">
                {current.subtitle}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom area */}
        <div className="flex flex-col items-center gap-8 pb-6">
          {/* Dots */}
          <div className="flex items-center gap-2.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`rounded-full transition-all duration-500 cursor-pointer ${
                  i === page
                    ? 'w-7 h-[6px] bg-[#d0a78b] shadow-[0_0_12px_rgba(208,167,139,0.3)]'
                    : 'w-[6px] h-[6px] bg-white/15 hover:bg-white/30'
                }`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>

          {/* Action */}
          {isLast ? (
            <button
              onClick={onComplete}
              className="w-full py-3.5 rounded-2xl bg-white text-[#050505] text-sm font-semibold tracking-wide shadow-lg shadow-white/10 active:scale-[0.97] transition-all duration-200 cursor-pointer hover:bg-white/90 font-['SF_Pro_Text',system-ui,sans-serif]"
            >
              Get Started
            </button>
          ) : (
            <button
              onClick={() => setPage(p => p + 1)}
              className="w-full py-3.5 rounded-2xl bg-[#d0a78b] text-[#050505] text-sm font-semibold tracking-wide shadow-lg shadow-[#d0a78b]/15 active:scale-[0.97] transition-all duration-200 cursor-pointer hover:bg-[#d0a78b]/90 font-['SF_Pro_Text',system-ui,sans-serif]"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
