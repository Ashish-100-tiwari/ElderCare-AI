"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

import type { CompanionState } from "@/lib/avatar/types";

/**
 * The built-in illustrated companion — a warm, human-looking assistant drawn
 * as inline SVG so the demo needs no external asset, video or API key.
 *
 * It renders the four states the product needs (idle, listening, thinking,
 * speaking). When a live avatar provider is registered, `VirtualCompanion`
 * swaps this out for the provider's video without touching this file.
 */

interface CompanionFaceProps {
  state: CompanionState;
  /** Skin/hair palette can be adjusted per senior later if we localise. */
  className?: string;
}

export function CompanionFace({ state, className }: CompanionFaceProps) {
  const reduceMotion = useReducedMotion();
  const [blinking, setBlinking] = useState(false);

  // Natural, irregular blinking — a constant rhythm reads as robotic.
  useEffect(() => {
    if (reduceMotion) return;
    let timer: number;

    const scheduleBlink = () => {
      timer = window.setTimeout(() => {
        setBlinking(true);
        window.setTimeout(() => setBlinking(false), 140);
        scheduleBlink();
      }, 2200 + Math.random() * 2600);
    };

    scheduleBlink();
    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  const speaking = state === "speaking";
  const thinking = state === "thinking";
  const listening = state === "listening";

  return (
    <svg
      viewBox="0 0 220 220"
      className={className}
      role="img"
      aria-label="Your companion, Asha"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="companion-bg" cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#d3f5ee" />
          <stop offset="65%" stopColor="#a7ebdd" />
          <stop offset="100%" stopColor="#6edbc8" />
        </radialGradient>
        <linearGradient id="companion-skin-2" x1="30%" y1="0%" x2="75%" y2="100%">
          <stop offset="0%" stopColor="#f2c9a2" />
          <stop offset="100%" stopColor="#dda679" />
        </linearGradient>
        <linearGradient id="companion-hair" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#453026" />
          <stop offset="100%" stopColor="#241812" />
        </linearGradient>
        <linearGradient id="companion-shirt" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#12a594" />
          <stop offset="100%" stopColor="#0a6a60" />
        </linearGradient>
        <clipPath id="companion-clip">
          <circle cx="110" cy="110" r="104" />
        </clipPath>
      </defs>

      <circle cx="110" cy="110" r="104" fill="url(#companion-bg)" />

      <g clipPath="url(#companion-clip)">
        {/* Soft light behind the shoulders */}
        <circle cx="110" cy="96" r="72" fill="#ffffff" opacity="0.28" />

        <motion.g
          animate={
            reduceMotion
              ? undefined
              : listening
                ? { y: [0, -2, 0], rotate: [0, -1.6, 0] }
                : { y: [0, -3, 0] }
          }
          transition={{ duration: listening ? 3.2 : 4.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformBox: "fill-box", transformOrigin: "center bottom" }}
        >
          {/* Shoulders / torso */}
          <path
            d="M 26 224 C 26 178 62 156 110 156 C 158 156 194 178 194 224 Z"
            fill="url(#companion-shirt)"
          />
          {/* Collar */}
          <path d="M 92 158 L 110 178 L 128 158 L 118 153 L 110 164 L 102 153 Z" fill="#ffffff" opacity="0.92" />

          {/* Neck */}
          <path d="M 96 128 H 124 V 156 C 124 162 96 162 96 156 Z" fill="#dda679" />

          {/* Hair back */}
          <path
            d="M 58 104 C 54 60 76 34 110 34 C 144 34 166 60 162 104 C 166 128 158 146 150 150 C 152 118 146 96 140 90 C 126 100 94 100 80 90 C 74 96 68 118 70 150 C 62 146 54 128 58 104 Z"
            fill="url(#companion-hair)"
          />

          {/* Face */}
          <ellipse cx="110" cy="102" rx="42" ry="48" fill="url(#companion-skin-2)" />

          {/* Ears */}
          <ellipse cx="68" cy="104" rx="7" ry="11" fill="#d79f73" />
          <ellipse cx="152" cy="104" rx="7" ry="11" fill="#d79f73" />

          {/* Hair front / fringe */}
          <path
            d="M 68 92 C 66 56 86 40 110 40 C 134 40 154 56 152 92 C 142 74 130 66 110 66 C 92 66 76 74 68 92 Z"
            fill="url(#companion-hair)"
          />

          {/* Eyebrows — lift slightly while thinking */}
          <motion.g
            animate={reduceMotion ? undefined : { y: thinking ? -3 : 0 }}
            transition={{ duration: 0.4 }}
            fill="#33241c"
          >
            <path d="M 84 88 C 90 83 100 83 106 87 L 105 90 C 99 87 91 87 85 91 Z" />
            <path d="M 136 88 C 130 83 120 83 114 87 L 115 90 C 121 87 129 87 135 91 Z" />
          </motion.g>

          {/* Eyes */}
          <g>
            <ellipse cx="95" cy="101" rx="8.5" ry={blinking ? 0.9 : 6} fill="#ffffff" />
            <ellipse cx="125" cy="101" rx="8.5" ry={blinking ? 0.9 : 6} fill="#ffffff" />
            {!blinking ? (
              <motion.g
                animate={
                  reduceMotion
                    ? undefined
                    : thinking
                      ? { x: [0, 4, 4, 0], y: [0, -2.5, -2.5, 0] }
                      : listening
                        ? { x: [0, -1.5, 1.5, 0] }
                        : { x: 0, y: 0 }
                }
                transition={{
                  duration: thinking ? 2.4 : 5,
                  repeat: thinking || listening ? Infinity : 0,
                  ease: "easeInOut",
                }}
              >
                <circle cx="95" cy="101.5" r="4.2" fill="#3b2a22" />
                <circle cx="125" cy="101.5" r="4.2" fill="#3b2a22" />
                <circle cx="96.6" cy="99.8" r="1.5" fill="#ffffff" />
                <circle cx="126.6" cy="99.8" r="1.5" fill="#ffffff" />
              </motion.g>
            ) : null}
          </g>

          {/* Nose */}
          <path
            d="M 110 104 C 107 112 106 116 110 118 C 113 118 114 116 113 114"
            stroke="#c98f63"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />

          {/* Cheeks */}
          <ellipse cx="86" cy="116" rx="8" ry="5" fill="#e59a7f" opacity="0.4" />
          <ellipse cx="134" cy="116" rx="8" ry="5" fill="#e59a7f" opacity="0.4" />

          {/* Mouth — a gentle smile that animates while speaking */}
          <motion.g
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            animate={
              reduceMotion
                ? undefined
                : speaking
                  ? { scaleY: [1, 2.1, 1.2, 2.5, 1.1], scaleX: [1, 0.94, 1.02, 0.9, 1] }
                  : { scaleY: 1, scaleX: 1 }
            }
            transition={
              speaking
                ? { duration: 0.85, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.3 }
            }
          >
            <path
              d="M 98 128 C 103 134 117 134 122 128 C 118 133 102 133 98 128 Z"
              fill="#a8474a"
              stroke="#a8474a"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
          </motion.g>
        </motion.g>
      </g>

      {/* Listening ripples */}
      {listening && !reduceMotion
        ? [0, 0.6, 1.2].map((delay) => (
            <motion.circle
              key={delay}
              cx="110"
              cy="110"
              r="100"
              fill="none"
              stroke="#0b8677"
              strokeWidth="2.5"
              initial={{ opacity: 0.5, scale: 0.94 }}
              animate={{ opacity: 0, scale: 1.12 }}
              transition={{ duration: 1.8, repeat: Infinity, delay, ease: "easeOut" }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          ))
        : null}

      <circle cx="110" cy="110" r="103" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.7" />
    </svg>
  );
}
