"use client";

import React, { useEffect, useState } from "react";

interface LoginSuccessAnimationProps {
  onComplete: () => void;
  username?: string;
}

export default function LoginSuccessAnimation({
  onComplete,
  username = "Foodie",
}: LoginSuccessAnimationProps) {
  const [statusText, setStatusText] = useState("Preparing your Bhukkad Box...");
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setStatusText("Opening your Bhukkad Box..."), 600);
    const t2 = setTimeout(() => setStatusText("Packing hot Pizza & Burger..."), 1200);
    const t3 = setTimeout(() => setStatusText("Sealing fresh meal..."), 2100);
    const t4 = setTimeout(() => setStatusText("Stamping official seals..."), 2600);
    const t5 = setTimeout(() => {
      setStatusText(`Welcome, ${username}! Loading your feast...`);
      setIsDone(true);
    }, 3300);
    const t6 = setTimeout(() => {
      onComplete();
    }, 3800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
    };
  }, [onComplete, username]);

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#180e08]/90 backdrop-blur-md text-white select-none transition-opacity duration-300">
      <style jsx>{`
        /* 1. Box Appear */
        .box-root {
          transform-origin: 256px 330px;
          animation: boxAppear 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        @keyframes boxAppear {
          0% {
            opacity: 0;
            transform: scale(0.2) translateY(120px) rotate(-8deg);
          }
          70% {
            opacity: 1;
            transform: scale(1.06) translateY(-8px) rotate(1deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0) rotate(0deg);
          }
        }

        /* 2. Top Flaps Opening and Closing */
        .closed-lid {
          animation: closedLidCycle 3.8s ease-in-out forwards;
        }
        @keyframes closedLidCycle {
          0%, 15% { opacity: 1; transform: scaleY(1); }
          18%, 56% { opacity: 0; transform: scaleY(0); }
          60%, 100% { opacity: 1; transform: scaleY(1); }
        }

        .open-flap-left {
          transform-origin: 183px 168px;
          animation: flapLeftMotion 3.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        @keyframes flapLeftMotion {
          0%, 15% {
            opacity: 0;
            transform: rotateX(0deg) rotateZ(0deg) scale(0);
          }
          18% {
            opacity: 1;
            transform: scale(1) rotate(-15deg);
          }
          24%, 52% {
            opacity: 1;
            transform: scale(1) rotate(-42deg) translate(-16px, 12px);
          }
          58% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
          60%, 100% {
            opacity: 0;
            transform: scale(0);
          }
        }

        .open-flap-right {
          transform-origin: 346px 163px;
          animation: flapRightMotion 3.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        @keyframes flapRightMotion {
          0%, 15% {
            opacity: 0;
            transform: scale(0);
          }
          18% {
            opacity: 1;
            transform: scale(1) rotate(15deg);
          }
          24%, 52% {
            opacity: 1;
            transform: scale(1) rotate(42deg) translate(16px, 14px);
          }
          58% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
          60%, 100% {
            opacity: 0;
            transform: scale(0);
          }
        }

        /* Box impact squish when lid shuts */
        .box-body-group {
          transform-origin: 256px 380px;
          animation: boxSquish 3.8s ease-in-out forwards;
        }
        @keyframes boxSquish {
          0%, 57% { transform: scale(1); }
          59% { transform: scale(1.05, 0.94); }
          62% { transform: scale(0.98, 1.02); }
          65%, 100% { transform: scale(1); }
        }

        /* 3. Pizza Falling Inside */
        .pizza-actor {
          animation: pizzaFall 3.8s cubic-bezier(0.2, 0.8, 0.4, 1) forwards;
        }
        @keyframes pizzaFall {
          0%, 16% {
            opacity: 0;
            transform: translate(160px, -70px) scale(0.6) rotate(-40deg);
          }
          21% {
            opacity: 1;
            transform: translate(195px, 20px) scale(1.05) rotate(-15deg);
          }
          34% {
            opacity: 1;
            transform: translate(220px, 125px) scale(0.85) rotate(0deg);
          }
          40%, 100% {
            opacity: 0;
            transform: translate(225px, 195px) scale(0.4) rotate(15deg);
          }
        }

        /* 4. Burger Falling Inside */
        .burger-actor {
          animation: burgerFall 3.8s cubic-bezier(0.2, 0.8, 0.4, 1) forwards;
        }
        @keyframes burgerFall {
          0%, 25% {
            opacity: 0;
            transform: translate(320px, -70px) scale(0.6) rotate(40deg);
          }
          30% {
            opacity: 1;
            transform: translate(280px, 20px) scale(1.05) rotate(15deg);
          }
          43% {
            opacity: 1;
            transform: translate(260px, 130px) scale(0.85) rotate(-5deg);
          }
          49%, 100% {
            opacity: 0;
            transform: translate(255px, 195px) scale(0.4) rotate(-15deg);
          }
        }

        /* 5. Badge Left (Food Plate) */
        .badge-left-actor {
          transform-origin: 175px 289px;
          animation: badgeLeftStamp 3.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes badgeLeftStamp {
          0%, 64% {
            opacity: 0;
            transform: translate(-120px, -100px) scale(2) rotate(-30deg);
          }
          66% {
            opacity: 1;
          }
          73% {
            opacity: 1;
            transform: translate(0, 0) scale(1.18) rotate(4deg);
          }
          78% {
            opacity: 1;
            transform: translate(0, 0) scale(0.92) rotate(-1deg);
          }
          83%, 100% {
            opacity: 1;
            transform: translate(0, 0) scale(1) rotate(0deg);
          }
        }

        /* 6. Badge Right (BB) */
        .badge-right-actor {
          transform-origin: 353px 285px;
          animation: badgeRightStamp 3.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes badgeRightStamp {
          0%, 76% {
            opacity: 0;
            transform: translate(120px, -100px) scale(2) rotate(30deg);
          }
          78% {
            opacity: 1;
          }
          85% {
            opacity: 1;
            transform: translate(0, 0) scale(1.18) rotate(-4deg);
          }
          90% {
            opacity: 1;
            transform: translate(0, 0) scale(0.92) rotate(1deg);
          }
          95%, 100% {
            opacity: 1;
            transform: translate(0, 0) scale(1) rotate(0deg);
          }
        }

        .stamp-burst-left {
          transform-origin: 175px 289px;
          animation: burstPopLeft 3.8s ease-out forwards;
        }
        @keyframes burstPopLeft {
          0%, 72% { opacity: 0; transform: scale(0.3); }
          74% { opacity: 1; transform: scale(1.1); }
          80%, 100% { opacity: 0; transform: scale(1.4); }
        }

        .stamp-burst-right {
          transform-origin: 353px 285px;
          animation: burstPopRight 3.8s ease-out forwards;
        }
        @keyframes burstPopRight {
          0%, 84% { opacity: 0; transform: scale(0.3); }
          86% { opacity: 1; transform: scale(1.1); }
          92%, 100% { opacity: 0; transform: scale(1.4); }
        }
      `}</style>

      {/* Main Container */}
      <div className="relative w-80 h-80 sm:w-96 sm:h-96 flex items-center justify-center">
        <svg
          className="w-full h-full overflow-visible drop-shadow-2xl"
          viewBox="0 0 512 512"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="frontLeftGrad" x1="92" y1="172" x2="275" y2="405" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ea6423" />
              <stop offset="100%" stopColor="#d65114" />
            </linearGradient>

            <linearGradient id="frontRightGrad" x1="275" y1="215" x2="420" y2="405" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#c94e0f" />
              <stop offset="100%" stopColor="#b03e08" />
            </linearGradient>

            <linearGradient id="topClosedGrad" x1="92" y1="148" x2="417" y2="189" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#eb6522" />
              <stop offset="100%" stopColor="#db5517" />
            </linearGradient>

            <linearGradient id="cavityGrad" x1="256" y1="90" x2="256" y2="240" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#140b07" />
              <stop offset="100%" stopColor="#2a160d" />
            </linearGradient>
          </defs>

          {/* Overall Box Animation Root */}
          <g className="box-root">
            {/* Ground drop shadow */}
            <ellipse cx="256" cy="430" rx="160" ry="24" fill="#000000" opacity="0.45" />

            {/* Box Body Group */}
            <g className="box-body-group">
              {/* Deep Cavity Interior (Visible when flaps open) */}
              <polygon points="92,148 242,93 417,138 275,189" fill="url(#cavityGrad)" />
              <line x1="242" y1="93" x2="260" y2="195" stroke="#0e0704" strokeWidth="4.5" />

              {/* Falling Pizza */}
              <g className="pizza-actor">
                <g transform="scale(1.2)">
                  <path d="M -34,-24 C -14,-38 24,-38 44,-24 L 0,44 Z" fill="#e29338" stroke="#231f20" strokeWidth="3" strokeLinejoin="round" />
                  <path d="M -29,-21 C -11,-33 19,-33 37,-21 L 0,37 Z" fill="#d03b29" />
                  <path d="M -26,-19 C -9,-30 17,-30 33,-19 L 0,33 Z" fill="#ffd13b" />
                  <circle cx="-10" cy="-10" r="7" fill="#b32020" stroke="#8b1414" strokeWidth="1.5" />
                  <circle cx="12" cy="-12" r="6" fill="#b32020" stroke="#8b1414" strokeWidth="1.5" />
                  <circle cx="2" cy="10" r="6.5" fill="#b32020" stroke="#8b1414" strokeWidth="1.5" />
                  <ellipse cx="-4" cy="-2" rx="3.5" ry="2" fill="#3ea350" transform="rotate(-30 -4 -2)" />
                  <ellipse cx="10" cy="5" rx="3.5" ry="2" fill="#3ea350" transform="rotate(40 10 5)" />
                </g>
              </g>

              {/* Falling Burger */}
              <g className="burger-actor">
                <g transform="scale(1.15)">
                  <path d="M -26,10 C -26,20 26,20 26,10 Z" fill="#d9922e" stroke="#231f20" strokeWidth="3" strokeLinejoin="round" />
                  <rect x="-27" y="4" width="54" height="8" rx="4" fill="#543322" stroke="#231f20" strokeWidth="2.5" />
                  <path d="M -26,4 L 26,4 L 18,10 L 0,5 L -14,11 Z" fill="#ffb703" />
                  <rect x="-26" y="-1" width="52" height="6" rx="2.5" fill="#e53e3e" stroke="#231f20" strokeWidth="2" />
                  <path d="M -28,-3 C -22,-6 -18,-1 -12,-4 C -6,-1 0,-6 6,-2 C 12,-6 18,-2 28,-3 L 26,0 L -26,0 Z" fill="#48bb78" stroke="#231f20" strokeWidth="2" />
                  <path d="M -28,-4 C -28,-26 28,-26 28,-4 Z" fill="#e8a853" stroke="#231f20" strokeWidth="3" strokeLinejoin="round" />
                  <ellipse cx="-12" cy="-14" rx="2.2" ry="1.2" fill="#fff" transform="rotate(-20 -12 -14)" />
                  <ellipse cx="0" cy="-18" rx="2.2" ry="1.2" fill="#fff" />
                  <ellipse cx="12" cy="-13" rx="2.2" ry="1.2" fill="#fff" transform="rotate(25 12 -13)" />
                </g>
              </g>

              {/* Front Walls */}
              <polygon points="92,148 275,189 275,215 92,172" fill="#d75115" stroke="#231f20" strokeWidth="7.5" strokeLinejoin="round" />
              <polygon points="275,189 417,138 420,160 275,215" fill="#b03e08" stroke="#231f20" strokeWidth="7.5" strokeLinejoin="round" />
              <polygon points="92,172 275,215 275,405 92,357" fill="url(#frontLeftGrad)" stroke="#231f20" strokeWidth="7.5" strokeLinejoin="round" />
              <polygon points="275,215 420,160 420,343 275,405" fill="url(#frontRightGrad)" stroke="#231f20" strokeWidth="7.5" strokeLinejoin="round" />
              <line x1="275" y1="215" x2="275" y2="405" stroke="#231f20" strokeWidth="7.5" strokeLinecap="round" />

              {/* Closed Top Lid */}
              <g className="closed-lid">
                <polygon points="92,148 242,93 417,138 275,189" fill="url(#topClosedGrad)" stroke="#231f20" strokeWidth="7.5" strokeLinejoin="round" />
                <line x1="183" y1="168" x2="330" y2="115" stroke="#231f20" strokeWidth="7" strokeLinecap="round" />
              </g>

              {/* Open Top Flaps */}
              <g className="open-flap-left">
                <polygon points="92,148 275,189 240,110 65,75" fill="#ea6423" stroke="#231f20" strokeWidth="7" strokeLinejoin="round" />
              </g>

              <g className="open-flap-right">
                <polygon points="275,189 417,138 430,60 295,115" fill="#c44a0f" stroke="#231f20" strokeWidth="7" strokeLinejoin="round" />
              </g>

              {/* Badge 1: Front Face (Food Plate Emblem) */}
              <g className="badge-left-actor">
                <image href="/badge_left_clean.png" x="103" y="217" width="144" height="144" />
              </g>
              <g className="stamp-burst-left">
                <circle cx="175" cy="289" r="65" fill="none" stroke="#ffeaa7" strokeWidth="4" strokeDasharray="10 8" />
              </g>

              {/* Badge 2: Right Face (BB Emblem) */}
              <g className="badge-right-actor">
                <image href="/badge_right_clean.png" x="281" y="213" width="144" height="144" />
              </g>
              <g className="stamp-burst-right">
                <circle cx="353" cy="285" r="65" fill="none" stroke="#ffeaa7" strokeWidth="4" strokeDasharray="10 8" />
              </g>
            </g>
          </g>
        </svg>
      </div>

      {/* Status message */}
      <div className="mt-6 flex flex-col items-center gap-2 text-center px-4 max-w-sm">
        <p className="text-lg sm:text-xl font-bold tracking-tight text-amber-200 animate-pulse">
          {statusText}
        </p>
        <p className="text-xs text-amber-400/70 font-medium">
          Fresh Meals, Freshly Ordered
        </p>
      </div>

      {/* Skip button for user control */}
      <button
        type="button"
        onClick={onComplete}
        className="mt-6 px-4 py-1.5 text-xs text-amber-300/80 hover:text-amber-100 hover:bg-white/10 rounded-full transition-colors font-medium border border-amber-500/20"
      >
        Skip to Home &rarr;
      </button>
    </div>
  );
}
