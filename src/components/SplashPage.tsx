import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface SplashPageProps {
  onComplete: () => void;
}

export function SplashPage({ onComplete }: SplashPageProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 900);
    const t2 = setTimeout(() => setPhase('exit'), 2400);
    const t3 = setTimeout(() => onComplete(), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full"
          animate={{
            opacity: phase === 'enter' ? 0 : phase === 'hold' ? 0.12 : 0,
            scale: phase === 'enter' ? 0.5 : phase === 'hold' ? 1 : 0.7,
          }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ background: 'radial-gradient(circle at center, #d0a78b 0%, transparent 70%)' }}
        />
      </div>

      {/* Logo */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-8"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{
          opacity: phase === 'exit' ? 0 : 1,
          scale: phase === 'exit' ? 0.8 : phase === 'enter' ? 0.85 : 1,
        }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="w-28 h-28 rounded-full bg-gradient-to-br from-[#d0a78b]/15 to-amber-900/30 p-[1.5px] relative"
          animate={phase === 'hold' ? {
            boxShadow: [
              '0 0 0px rgba(208,167,139,0)',
              '0 0 30px rgba(208,167,139,0.2)',
              '0 0 0px rgba(208,167,139,0)',
            ],
          } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="w-full h-full rounded-full bg-[#080808] flex items-center justify-center border border-[#d0a78b]/10 overflow-hidden p-3.5">
            <img src="https://eburon.ai/icon-eburon.svg" alt="Eburon" className="w-full h-full object-contain" draggable={false} />
          </div>
        </motion.div>

        <div className="flex flex-col items-center gap-2">
          <motion.h1
            className="text-[28px] font-light tracking-wide text-white/90 font-['SF_Pro_Display',system-ui,sans-serif] uppercase"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            Beatrice
          </motion.h1>
          <motion.div
            className="h-px w-12 bg-[#d0a78b]/30"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.8, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.p
            className="text-[#d0a78b]/35 text-[11px] font-medium tracking-[0.35em] uppercase font-['SF_Pro_Text',system-ui,sans-serif]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
          >
            Eburon AI
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}
