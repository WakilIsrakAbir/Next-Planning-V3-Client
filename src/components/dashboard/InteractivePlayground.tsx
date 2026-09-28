'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Waves, Sparkles, RefreshCw, Palette } from 'lucide-react';

type SimpleMode = 'waves' | 'bubbles';

export default function InteractivePlayground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<SimpleMode>('waves');
  const [colorScheme, setColorScheme] = useState<'emerald' | 'pastel' | 'ocean'>('emerald');

  // Mouse tracking
  const mouseRef = useRef({
    x: -9999,
    y: -9999,
    targetX: -9999,
    targetY: -9999,
    isDown: false,
    speed: 0,
    prevX: -9999,
    prevY: -9999,
  });

  // Ripples created on click or fast mouse move
  const ripplesRef = useRef<{ x: number; y: number; radius: number; maxRadius: number; alpha: number; color: string }[]>([]);

  // Bubbles state
  const bubblesRef = useRef<
    {
      x: number;
      y: number;
      vx: number;
      vy: number;
      baseRadius: number;
      radius: number;
      color: string;
      phase: number;
    }[]
  >([]);

  // Color Palettes (Soft, pleasant, light theme colors)
  const PALETTES = {
    emerald: {
      name: 'Fresh Mint & Emerald',
      waves: [
        'rgba(16, 185, 129, 0.18)',
        'rgba(5, 150, 105, 0.15)',
        'rgba(52, 211, 153, 0.20)',
        'rgba(20, 184, 166, 0.16)',
        'rgba(13, 148, 136, 0.12)',
      ],
      lines: ['#059669', '#10b981', '#34d399', '#0d9488'],
      bubbles: ['#10b981', '#059669', '#34d399', '#14b8a6', '#0284c7'],
    },
    pastel: {
      name: 'Soft Rose & Lavender',
      waves: [
        'rgba(244, 63, 94, 0.15)',
        'rgba(168, 85, 247, 0.14)',
        'rgba(236, 72, 153, 0.18)',
        'rgba(99, 102, 241, 0.15)',
        'rgba(251, 146, 60, 0.13)',
      ],
      lines: ['#f43f5e', '#a855f7', '#ec4899', '#6366f1'],
      bubbles: ['#f43f5e', '#a855f7', '#ec4899', '#818cf8', '#fb923c'],
    },
    ocean: {
      name: 'Sky Blue & Cyan',
      waves: [
        'rgba(14, 165, 233, 0.18)',
        'rgba(6, 182, 212, 0.16)',
        'rgba(59, 130, 246, 0.14)',
        'rgba(56, 189, 248, 0.20)',
        'rgba(37, 99, 235, 0.12)',
      ],
      lines: ['#0ea5e9', '#06b6d4', '#3b82f6', '#0284c7'],
      bubbles: ['#0ea5e9', '#06b6d4', '#3b82f6', '#38bdf8', '#60a5fa'],
    },
  };

  // Initialize bubbles
  const initBubbles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const palette = PALETTES[colorScheme].bubbles;

    const bubbles = [];
    const count = 28;
    for (let i = 0; i < count; i++) {
      const r = Math.random() * 26 + 18;
      bubbles.push({
        x: Math.random() * (w - r * 2) + r,
        y: Math.random() * (h - r * 2) + r,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        baseRadius: r,
        radius: r,
        color: palette[i % palette.length],
        phase: Math.random() * Math.PI * 2,
      });
    }
    bubblesRef.current = bubbles;
  }, [colorScheme]);

  // Handle Resize
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = 520; // clean, fixed pleasant height

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    if (mode === 'bubbles') {
      initBubbles();
    }
  }, [mode, initBubbles]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  useEffect(() => {
    if (mode === 'bubbles') {
      initBubbles();
    }
  }, [mode, colorScheme, initBubbles]);

  // Add click ripple
  const addRipple = (x: number, y: number) => {
    const palette = PALETTES[colorScheme].lines;
    const color = palette[Math.floor(Math.random() * palette.length)];
    ripplesRef.current.push({
      x,
      y,
      radius: 5,
      maxRadius: 120,
      alpha: 0.7,
      color,
    });
  };

  // Main Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let step = 0;

    const render = () => {
      step += 0.02;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      // Mouse position easing for buttery smooth interaction
      const mouse = mouseRef.current;
      if (mouse.targetX !== -9999) {
        mouse.x += (mouse.targetX - mouse.x) * 0.12;
        mouse.y += (mouse.targetY - mouse.y) * 0.12;
      } else {
        mouse.x = -9999;
        mouse.y = -9999;
      }

      // 1. Clean Light Background (Soft Off-White with faint gradient)
      ctx.clearRect(0, 0, w, h);
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#fcfdfd');
      bgGrad.addColorStop(0.5, '#ffffff');
      bgGrad.addColorStop(1, '#f8fafc');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Subtle light grid / dots
      ctx.fillStyle = '#f1f5f9';
      for (let gx = 30; gx < w; gx += 40) {
        for (let gy = 30; gy < h; gy += 40) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const activePalette = PALETTES[colorScheme];

      // -----------------------------------------------------------------
      // MODE 1: SILK WAVES (Simple, soothing, interactive flowing ribbons)
      // -----------------------------------------------------------------
      if (mode === 'waves') {
        const waveCount = 5;
        const waveColors = activePalette.waves;
        const lineColors = activePalette.lines;

        for (let i = 0; i < waveCount; i++) {
          ctx.beginPath();
          const baseY = h * 0.45 + i * 28;
          ctx.moveTo(0, h);
          ctx.lineTo(0, baseY);

          const segments = 45;
          const segmentWidth = w / segments;

          for (let s = 0; s <= segments; s++) {
            const x = s * segmentWidth;

            // Natural wave equation
            const freq1 = 0.0035 + i * 0.0006;
            const freq2 = 0.007 + i * 0.001;
            const amp1 = 35 + i * 8;
            const amp2 = 18 - i * 2;

            let waveY =
              baseY +
              Math.sin(x * freq1 + step * (1.2 + i * 0.25) + i * 1.5) * amp1 +
              Math.cos(x * freq2 - step * (0.8 + i * 0.2)) * amp2;

            // Mouse dynamic interactive pull
            if (mouse.x !== -9999) {
              const dx = x - mouse.x;
              const dy = waveY - mouse.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 180) {
                const influence = Math.pow(1 - dist / 180, 2);
                waveY += (mouse.y - waveY) * influence * 0.65;
              }
            }

            if (s === 0) {
              ctx.lineTo(x, waveY);
            } else {
              const prevX = (s - 1) * segmentWidth;
              const midX = (prevX + x) / 2;
              ctx.quadraticCurveTo(prevX, waveY, midX, waveY);
            }
          }

          ctx.lineTo(w, h);
          ctx.closePath();

          // Soft translucent fill
          ctx.fillStyle = waveColors[i % waveColors.length];
          ctx.fill();

          // Delicate crest line
          ctx.strokeStyle = lineColors[i % lineColors.length];
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }
      }

      // -----------------------------------------------------------------
      // MODE 2: FLOATING ZEN BUBBLES (Soft pastel floating orbs)
      // -----------------------------------------------------------------
      if (mode === 'bubbles') {
        const bubbles = bubblesRef.current;

        for (let i = 0; i < bubbles.length; i++) {
          const b = bubbles[i];

          // Gentle movement
          b.phase += 0.02;
          b.x += b.vx + Math.sin(b.phase) * 0.4;
          b.y += b.vy + Math.cos(b.phase) * 0.4;

          // Bounce off walls
          if (b.x - b.radius < 0) {
            b.x = b.radius;
            b.vx *= -1;
          } else if (b.x + b.radius > w) {
            b.x = w - b.radius;
            b.vx *= -1;
          }

          if (b.y - b.radius < 0) {
            b.y = b.radius;
            b.vy *= -1;
          } else if (b.y + b.radius > h) {
            b.y = h - b.radius;
            b.vy *= -1;
          }

          // Mouse gentle repulsion
          if (mouse.x !== -9999) {
            const dx = b.x - mouse.x;
            const dy = b.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 140 && dist > 0) {
              const force = (1 - dist / 140) * 4;
              b.vx += (dx / dist) * force * 0.3;
              b.vy += (dy / dist) * force * 0.3;
              b.radius = b.baseRadius * (1 + (1 - dist / 140) * 0.25);
            } else {
              b.radius += (b.baseRadius - b.radius) * 0.1;
            }
          } else {
            b.radius += (b.baseRadius - b.radius) * 0.1;
          }

          // Friction
          b.vx *= 0.98;
          b.vy *= 0.98;

          // Render soft glowing bubble with radial gradient
          const grad = ctx.createRadialGradient(
            b.x - b.radius * 0.3,
            b.y - b.radius * 0.3,
            b.radius * 0.1,
            b.x,
            b.y,
            b.radius
          );
          grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
          grad.addColorStop(0.35, `${b.color}55`);
          grad.addColorStop(1, `${b.color}15`);

          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();

          // Clean soft border
          ctx.strokeStyle = `${b.color}66`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Soft specular highlight
          ctx.beginPath();
          ctx.arc(b.x - b.radius * 0.35, b.y - b.radius * 0.35, b.radius * 0.2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.fill();
        }
      }

      // -----------------------------------------------------------------
      // RIPPLES (On click or interaction)
      // -----------------------------------------------------------------
      const ripples = ripplesRef.current;
      for (let r = ripples.length - 1; r >= 0; r--) {
        const rip = ripples[r];
        rip.radius += 2.8;
        rip.alpha -= 0.02;

        if (rip.alpha <= 0 || rip.radius >= rip.maxRadius) {
          ripples.splice(r, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
        ctx.strokeStyle = rip.color;
        ctx.globalAlpha = Math.max(0, rip.alpha);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      // -----------------------------------------------------------------
      // MOUSE CURSOR GLOW (Soft subtle light dot that follows cursor)
      // -----------------------------------------------------------------
      if (mouse.x !== -9999) {
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = activePalette.lines[0];
        ctx.shadowColor = activePalette.lines[0];
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [mode, colorScheme]);

  // Pointer event listeners
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    mouseRef.current.targetX = x;
    mouseRef.current.targetY = y;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mouseRef.current.isDown = true;
    addRipple(x, y);

    // If bubbles mode, push nearby bubbles outward
    if (mode === 'bubbles') {
      const bubbles = bubblesRef.current;
      for (let b of bubbles) {
        const dx = b.x - x;
        const dy = b.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180 && dist > 0) {
          b.vx += (dx / dist) * 9;
          b.vy += (dy / dist) * 9;
        }
      }
    }
  };

  const handlePointerUp = () => {
    mouseRef.current.isDown = false;
  };

  const handlePointerLeave = () => {
    mouseRef.current.targetX = -9999;
    mouseRef.current.targetY = -9999;
    mouseRef.current.isDown = false;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 select-none"
      style={{ height: '520px' }}
    >
      {/* Minimalist Top Control Bar */}
      <div className="absolute top-3.5 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 p-2 px-3.5 rounded-xl bg-white/95 backdrop-blur-md border border-gray-200/90 shadow-sm text-xs">
        {/* Left: Mode switcher (Silk Waves or Floating Bubbles) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold text-gray-700 mr-2 text-[12px]">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Interactive Canvas:</span>
          </div>

          <button
            onClick={() => setMode('waves')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition cursor-pointer ${
              mode === 'waves'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
            }`}
          >
            <Waves className="w-3.5 h-3.5" />
            <span>Silk Waves</span>
          </button>

          <button
            onClick={() => setMode('bubbles')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition cursor-pointer ${
              mode === 'bubbles'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
            }`}
          >
            <span className="text-sm leading-none">🫧</span>
            <span>Floating Orbs</span>
          </button>
        </div>

        {/* Right: Color Scheme & Reset */}
        <div className="flex items-center gap-2">
          {/* Color Switcher */}
          <div className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1">
            <Palette className="w-3.5 h-3.5 text-emerald-600" />
            <select
              value={colorScheme}
              onChange={(e) => setColorScheme(e.target.value as 'emerald' | 'pastel' | 'ocean')}
              className="bg-transparent text-gray-700 font-medium text-xs outline-none cursor-pointer"
            >
              <option value="emerald">Mint Emerald</option>
              <option value="ocean">Sky Ocean</option>
              <option value="pastel">Rose Lavender</option>
            </select>
          </div>

          {/* Reset / Randomize */}
          <button
            onClick={() => {
              if (mode === 'bubbles') initBubbles();
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 text-xs font-medium transition cursor-pointer"
            title="Refresh animation"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Light HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className="w-full h-full block cursor-pointer touch-none"
      />

      {/* Minimal Footer Instruction */}
      <div className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-between pointer-events-none text-[11px] text-gray-600">
        <span className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-md border border-gray-200/80 shadow-xs">
          💡 {mode === 'waves' ? 'মাউস নাড়ালে তরঙ্গের মতো ঢেউ খেলবে ও ক্লিক করলে সুন্দর রিপল তৈরি হবে।' : 'মাউস দিয়ে বুদবুদগুলো সরান ও ক্লিক করে পুশ করুন।'}
        </span>
        <span className="bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-gray-200/80 shadow-xs font-medium text-emerald-700">
          Smooth 60 FPS • Light Theme
        </span>
      </div>
    </div>
  );
}
