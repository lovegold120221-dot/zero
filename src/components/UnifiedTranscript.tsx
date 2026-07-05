import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface UnifiedTranscriptProps {
  userText: string;
  modelText: string;
  userName: string;
  modelName: string;
}

export function UnifiedTranscript({ userText, modelText, userName, modelName }: UnifiedTranscriptProps) {
  let activeText = '';
  let activeName = '';
  let isModel = false;

  if (modelText) {
    activeText = modelText;
    activeName = modelName;
    isModel = true;
  } else if (userText) {
    activeText = userText;
    activeName = userName;
    isModel = false;
  }

  return (
    <div className="flex flex-col items-center justify-end w-full max-w-3xl mx-auto h-full">
      <AnimatePresence mode="wait">
        {activeText && (
          <motion.div
            key={isModel ? 'model' : 'user'}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center justify-end text-center w-full"
          >
            <span className={`text-xs font-bold opacity-50 uppercase tracking-widest mb-1 ${isModel ? 'text-[#d0a78b]' : 'text-gray-400'}`}>
              {activeName}
            </span>
            <p className={`text-base sm:text-lg md:text-xl font-medium leading-relaxed line-clamp-3 text-ellipsis overflow-hidden ${isModel ? 'text-[#d0a78b] drop-shadow-[0_0_15px_rgba(208,167,139,0.3)]' : 'text-gray-200 drop-shadow-md'}`}>
              {activeText}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
