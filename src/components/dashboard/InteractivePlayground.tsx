'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Scissors,
  Hand,
  RotateCcw,
  Sparkles,
  Maximize2,
  Minimize2,
  Sliders,
  Palette,
  CircleDot,
  Waves,
  Magnet,
  Zap,
  HelpCircle,
} from 'lucide-react';

type GameMode = 'cloth' | 'marbles' | 'liquid' | 'sand';
type ToolType = 'drag' | 'cut' | 'blast';
type PaletteTheme = 'emerald' | 'berry' | 'ocean' | 'citrus' | 'neon';

interface ClothPoint {
  x: number;
  y: number;
  oldX: number;
  oldY: number;
  pinned: boolean;
  color: string;
}

interface ClothConstraint {
  p1: ClothPoint;
  p2: ClothPoint;
  length: number;
  broken: boolean;
  color: string;
}

interface Marble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  borderColor: string;
  isHeld: boolean;
  squishX: number;
  squishY: number;
}

interface SandParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
}

const PALETTES: Record<PaletteTheme, { name: string; colors: string[]; primary: string }> = {
  emerald: {
    name: 'Emerald Mint',
    primary: '#059669',
    colors: ['#059669', '#10b981', '#34d399', '#0d9488', '#0284c7'],
  },
  berry: {
    name: 'Berry Punch',
    primary: '#e11d48',
    colors: ['#e11d48', '#f43f5e', '#ec4899', '#a855f7', '#6366f1'],
  },
  ocean: {
    name: 'Deep Blue',
    primary: '#0284c7',
    colors: ['#0284c7', '#38bdf8', '#2563eb', '#06b6d4', '#64748b'],
  },
  citrus: {
    name: 'Citrus Sunset',
    primary: '#ea580c',
    colors: ['#ea580c', '#f59e0b', '#f97316', '#eab308', '#dc2626'],
  },
  neon: {
    name: 'Vibrant Pop',
    primary: '#8b5cf6',
    colors: ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'],
  },
};

export default function InteractivePlayground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // States
  const [mode, setMode] = useState<GameMode>('cloth');
  const [activeTool, setActiveTool] = useState<ToolType>('drag');
  const [palette, setPalette] = useState<PaletteTheme>('emerald');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(60);
  const [showHelp, setShowHelp] = useState<boolean>(false);

  // Animation frame & state refs
  const animFrameRef = useRef<number | null>(null);

  // Cloth refs
  const clothPointsRef = useRef<ClothPoint[]>([]);
  const clothConstraintsRef = useRef<ClothConstraint[]>([]);

  // Marbles ref
  const marblesRef = useRef<Marble[]>([]);

  // Sand ref
  const sandRef = useRef<SandParticle[]>([]);

  // Liquid ripple cells ref
  const liquidRef = useRef<{
    width: number;
    height: number;
    buffer1: Float32Array;
    buffer2: Float32Array;
  }>({
    width: 0,
    height: 0,
    buffer1: new Float32Array(0),
    buffer2: new Float32Array(0),
  });

  // Mouse & interaction state
  const mouseRef = useRef<{
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    isDown: boolean;
    button: number;
    grabbedPoint: ClothPoint | null;
    grabbedMarble: Marble | null;
  }>({
    x: -9999,
    y: -9999,
    prevX: -9999,
    prevY: -9999,
    isDown: false,
    button: 0,
    grabbedPoint: null,
    grabbedMarble: null,
  });

  // FPS tracking
  const fpsTrackerRef = useRef<{ frames: number; lastTime: number }>({
    frames: 0,
    lastTime: performance.now(),
  });

  // Helper: line intersection test for scissors / cutting
  const checkLineIntersection = (
    p1x: number,
    p1y: number,
    p2x: number,
    p2y: number,
    p3x: number,
    p3y: number,
    p4x: number,
    p4y: number
  ) => {
    const denom = (p4y - p3y) * (p2x - p1x) - (p4x - p3x) * (p2y - p1y);
    if (denom === 0) return false;
    const ua = ((p4x - p3x) * (p1y - p3y) - (p4y - p3y) * (p1x - p3x)) / denom;
    const ub = ((p2x - p1x) * (p1y - p3y) - (p2y - p1y) * (p1x - p3x)) / denom;
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  };

  // -------------------------------------------------------------
  // INITIALIZERS FOR EACH INTERACTIVE TOY
  // -------------------------------------------------------------

  // 1. Initialize Tearable Cloth (Textile Fabric with Verlet Integration)
  const initCloth = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;

    const points: ClothPoint[] = [];
    const constraints: ClothConstraint[] = [];

    const cols = Math.min(50, Math.floor(w / 18));
    const rows = 28;
    const spacingX = Math.min(20, (w * 0.78) / (cols - 1));
    const spacingY = 16;
    const startX = (w - (cols - 1) * spacingX) / 2;
    const startY = 35;

    const colors = PALETTES[palette].colors;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * spacingX;
        const y = startY + r * spacingY;
        // Pin every 3rd or 4th point along top row
        const pinned = r === 0 && (c % 4 === 0 || c === cols - 1);
        const colColor = colors[(c + r) % colors.length];

        const pt: ClothPoint = {
          x,
          y,
          oldX: x,
          oldY: y,
          pinned,
          color: colColor,
        };
        points.push(pt);

        // Horizontal constraint
        if (c > 0) {
          const leftPt = points[points.length - 2];
          constraints.push({
            p1: leftPt,
            p2: pt,
            length: spacingX,
            broken: false,
            color: colColor,
          });
        }

        // Vertical constraint
        if (r > 0) {
          const upPt = points[(r - 1) * cols + c];
          constraints.push({
            p1: upPt,
            p2: pt,
            length: spacingY,
            broken: false,
            color: colColor,
          });
        }
      }
    }

    clothPointsRef.current = points;
    clothConstraintsRef.current = constraints;
  }, [palette]);

  // 2. Initialize Bouncy Jelly Marbles
  const initMarbles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    const marbles: Marble[] = [];
    const colors = PALETTES[palette].colors;
    const count = 18;

    for (let i = 0; i < count; i++) {
      const radius = Math.random() * 24 + 20;
      marbles.push({
        x: Math.random() * (w - 100) + 50,
        y: Math.random() * (h - 150) + 60,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        radius,
        color: colors[i % colors.length],
        borderColor: '#ffffff',
        isHeld: false,
        squishX: 1,
        squishY: 1,
      });
    }

    marblesRef.current = marbles;
  }, [palette]);

  // 3. Initialize Liquid Water Ripple Simulation
  const initLiquid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor((canvas.width / dpr) / 4);
    const h = Math.floor((canvas.height / dpr) / 4);

    const size = w * h;
    liquidRef.current = {
      width: w,
      height: h,
      buffer1: new Float32Array(size),
      buffer2: new Float32Array(size),
    };
  }, []);

  // 4. Initialize Magnetic Colorful Sand
  const initSand = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    const sand: SandParticle[] = [];
    const colors = PALETTES[palette].colors;
    const count = 750;

    for (let i = 0; i < count; i++) {
      sand.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        color: colors[i % colors.length],
        size: Math.random() * 3 + 2,
      });
    }

    sandRef.current = sand;
  }, [palette]);

  // Initialize current mode
  const initCurrentMode = useCallback(() => {
    if (mode === 'cloth') initCloth();
    else if (mode === 'marbles') initMarbles();
    else if (mode === 'liquid') initLiquid();
    else if (mode === 'sand') initSand();
  }, [mode, initCloth, initMarbles, initLiquid, initSand]);

  // Resize Handler
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = isFullscreen ? window.innerHeight : 650;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    initCurrentMode();
  }, [isFullscreen, initCurrentMode]);

  // Trigger Blast Force in active mode
  const triggerBlast = useCallback(
    (x?: number, y?: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const blastX = x !== undefined ? x : w / 2;
      const blastY = y !== undefined ? y : h / 2;

      if (mode === 'cloth') {
        // Displace and stretch nearby cloth points
        for (let pt of clothPointsRef.current) {
          const dx = pt.x - blastX;
          const dy = pt.y - blastY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180 && !pt.pinned) {
            const force = (1 - dist / 180) * 35;
            pt.x += (dx / (dist || 1)) * force;
            pt.y += (dy / (dist || 1)) * force;
          }
        }
      } else if (mode === 'marbles') {
        for (let m of marblesRef.current) {
          const dx = m.x - blastX;
          const dy = m.y - blastY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 220) {
            const force = (1 - dist / 220) * 22;
            m.vx += (dx / (dist || 1)) * force;
            m.vy += (dy / (dist || 1)) * force;
          }
        }
      } else if (mode === 'sand') {
        for (let s of sandRef.current) {
          const dx = s.x - blastX;
          const dy = s.y - blastY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) {
            const force = (1 - dist / 200) * 25;
            s.vx += (dx / (dist || 1)) * force;
            s.vy += (dy / (dist || 1)) * force;
          }
        }
      } else if (mode === 'liquid') {
        const liq = liquidRef.current;
        const cellX = Math.floor((blastX / w) * liq.width);
        const cellY = Math.floor((blastY / h) * liq.height);
        if (cellX > 2 && cellX < liq.width - 2 && cellY > 2 && cellY < liq.height - 2) {
          liq.buffer1[cellY * liq.width + cellX] = 450;
        }
      }
    },
    [mode]
  );

  // -------------------------------------------------------------
  // ANIMATION LOOP (60FPS CLEAN LIGHT THEME RENDERER)
  // -------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = (timestamp: number) => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // Track FPS
      fpsTrackerRef.current.frames++;
      if (timestamp - fpsTrackerRef.current.lastTime >= 500) {
        setFps(Math.round((fpsTrackerRef.current.frames * 1000) / (timestamp - fpsTrackerRef.current.lastTime)));
        fpsTrackerRef.current.frames = 0;
        fpsTrackerRef.current.lastTime = timestamp;
      }

      // Crisp Light Studio Background with subtle fine gradient
      ctx.globalCompositeOperation = 'source-over';
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#f8fafc');
      bgGrad.addColorStop(0.5, '#ffffff');
      bgGrad.addColorStop(1, '#f1f5f9');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Delicate studio dot grid for modern aesthetic
      ctx.fillStyle = '#e2e8f0';
      const gridStep = 32;
      for (let gx = gridStep; gx < width; gx += gridStep) {
        for (let gy = gridStep; gy < height; gy += gridStep) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const mouse = mouseRef.current;
      const isCutting = activeTool === 'cut' || mouse.button === 2;

      // ---------------------------------------------------------
      // MODE 1: TEARABLE TEXTILE CLOTH (SILK PHYSICS)
      // ---------------------------------------------------------
      if (mode === 'cloth') {
        const points = clothPointsRef.current;
        const constraints = clothConstraintsRef.current;

        // Verlet physics step
        const gravity = 0.28;
        const friction = 0.985;

        for (let pt of points) {
          if (!pt.pinned) {
            const vx = (pt.x - pt.oldX) * friction;
            const vy = (pt.y - pt.oldY) * friction;
            pt.oldX = pt.x;
            pt.oldY = pt.y;
            pt.x += vx;
            pt.y += vy + gravity;
          }
        }

        // Mouse Grab & Cut
        if (mouse.isDown) {
          if (isCutting && mouse.prevX !== -9999) {
            // Cut / Slice constraints that intersect mouse line
            for (let c of constraints) {
              if (!c.broken) {
                if (
                  checkLineIntersection(
                    mouse.prevX,
                    mouse.prevY,
                    mouse.x,
                    mouse.y,
                    c.p1.x,
                    c.p1.y,
                    c.p2.x,
                    c.p2.y
                  )
                ) {
                  c.broken = true;
                }
              }
            }
          } else if (activeTool === 'drag') {
            // Grab closest point
            if (!mouse.grabbedPoint) {
              let closest: ClothPoint | null = null;
              let closestDist = 35;
              for (let pt of points) {
                const dx = pt.x - mouse.x;
                const dy = pt.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < closestDist) {
                  closest = pt;
                  closestDist = dist;
                }
              }
              mouse.grabbedPoint = closest;
            }

            if (mouse.grabbedPoint && !mouse.grabbedPoint.pinned) {
              mouse.grabbedPoint.x = mouse.x;
              mouse.grabbedPoint.y = mouse.y;
            }
          }
        } else {
          mouse.grabbedPoint = null;
        }

        // Constraint relaxation (Spring physics iterations)
        const iterations = 4;
        for (let it = 0; it < iterations; it++) {
          for (let c of constraints) {
            if (c.broken) continue;
            const dx = c.p2.x - c.p1.x;
            const dy = c.p2.y - c.p1.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const diff = (c.length - dist) / dist;

            // Auto-tear on extreme elongation tension
            if (dist > c.length * 3.4) {
              c.broken = true;
              continue;
            }

            const p1Weight = c.p1.pinned ? 0 : 0.5;
            const p2Weight = c.p2.pinned ? 0 : 0.5;

            c.p1.x -= dx * diff * p1Weight;
            c.p1.y -= dy * diff * p1Weight;
            c.p2.x += dx * diff * p2Weight;
            c.p2.y += dy * diff * p2Weight;
          }
        }

        // Render Cloth Shadows first for depth
        ctx.beginPath();
        for (let c of constraints) {
          if (c.broken) continue;
          ctx.moveTo(c.p1.x + 2, c.p1.y + 4);
          ctx.lineTo(c.p2.x + 2, c.p2.y + 4);
        }
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Render Cloth Threads
        ctx.beginPath();
        for (let c of constraints) {
          if (c.broken) continue;
          ctx.moveTo(c.p1.x, c.p1.y);
          ctx.lineTo(c.p2.x, c.p2.y);
        }
        ctx.strokeStyle = PALETTES[palette].primary;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Render Pins along the top hanging rod
        for (let pt of points) {
          if (pt.pinned) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#0f172a';
            ctx.fill();
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      }

      // ---------------------------------------------------------
      // MODE 2: BOUNCY SQUISHY JELLY MARBLES
      // ---------------------------------------------------------
      else if (mode === 'marbles') {
        const marbles = marblesRef.current;
        const gravity = 0.22;
        const bounce = 0.78;

        for (let i = 0; i < marbles.length; i++) {
          const m = marbles[i];

          if (m === mouse.grabbedMarble) {
            m.vx = (mouse.x - m.x) * 0.35;
            m.vy = (mouse.y - m.y) * 0.35;
            m.x = mouse.x;
            m.y = mouse.y;
          } else {
            m.vy += gravity;
            m.x += m.vx;
            m.y += m.vy;
            m.vx *= 0.99;
          }

          // Wall Collisions with squish
          if (m.x - m.radius < 0) {
            m.x = m.radius;
            m.vx = -m.vx * bounce;
            m.squishX = 0.7;
          }
          if (m.x + m.radius > width) {
            m.x = width - m.radius;
            m.vx = -m.vx * bounce;
            m.squishX = 0.7;
          }
          if (m.y + m.radius > height) {
            m.y = height - m.radius;
            m.vy = -m.vy * bounce;
            m.squishY = 0.65;
            if (Math.abs(m.vy) < 0.5) m.vy = 0;
          }
          if (m.y - m.radius < 0) {
            m.y = m.radius;
            m.vy = -m.vy * bounce;
          }

          // Squish recovery
          m.squishX += (1 - m.squishX) * 0.12;
          m.squishY += (1 - m.squishY) * 0.12;

          // Marble to Marble collisions
          for (let j = i + 1; j < marbles.length; j++) {
            const m2 = marbles[j];
            const dx = m2.x - m.x;
            const dy = m2.y - m.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = m.radius + m2.radius;

            if (dist < minDist && dist > 0) {
              const overlap = (minDist - dist) * 0.5;
              const nx = dx / dist;
              const ny = dy / dist;

              m.x -= nx * overlap;
              m.y -= ny * overlap;
              m2.x += nx * overlap;
              m2.y += ny * overlap;

              const kx = m.vx - m2.vx;
              const ky = m.vy - m2.vy;
              const p = 2 * (nx * kx + ny * ky) / 2;

              m.vx -= p * nx * bounce;
              m.vy -= p * ny * bounce;
              m2.vx += p * nx * bounce;
              m2.vy += p * ny * bounce;
            }
          }

          // Soft Shadow
          ctx.beginPath();
          ctx.ellipse(m.x + 3, height - 8, Math.max(5, m.radius * 0.8), 5, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
          ctx.fill();

          // Render Marble with Glassmorphic Gradient
          ctx.save();
          ctx.translate(m.x, m.y);
          ctx.scale(m.squishX, m.squishY);

          const grad = ctx.createRadialGradient(-m.radius * 0.35, -m.radius * 0.35, 2, 0, 0, m.radius);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.35, m.color);
          grad.addColorStop(1, PALETTES[palette].primary);

          ctx.beginPath();
          ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 4;
          ctx.fill();

          // Top Gloss Reflection
          ctx.beginPath();
          ctx.ellipse(-m.radius * 0.3, -m.radius * 0.35, m.radius * 0.4, m.radius * 0.22, -Math.PI / 4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.fill();
          ctx.restore();
        }

        // Grab / Fling Handler for Marbles
        if (mouse.isDown && !mouse.grabbedMarble) {
          for (let m of marbles) {
            const dx = m.x - mouse.x;
            const dy = m.y - mouse.y;
            if (Math.sqrt(dx * dx + dy * dy) < m.radius + 10) {
              mouse.grabbedMarble = m;
              break;
            }
          }
        } else if (!mouse.isDown && mouse.grabbedMarble) {
          const gm = mouse.grabbedMarble;
          gm.vx = (mouse.x - mouse.prevX) * 0.75;
          gm.vy = (mouse.y - mouse.prevY) * 0.75;
          mouse.grabbedMarble = null;
        }
      }

      // ---------------------------------------------------------
      // MODE 3: LIQUID WATER RIPPLE ENGINE
      // ---------------------------------------------------------
      else if (mode === 'liquid') {
        const liq = liquidRef.current;
        const lw = liq.width;
        const lh = liq.height;

        if (lw > 0 && lh > 0) {
          // Mouse ripple injection
          if (mouse.x > 0 && mouse.x < width && mouse.y > 0 && mouse.y < height) {
            const cx = Math.floor((mouse.x / width) * lw);
            const cy = Math.floor((mouse.y / height) * lh);
            if (cx > 1 && cx < lw - 2 && cy > 1 && cy < lh - 2) {
              liq.buffer1[cy * lw + cx] = mouse.isDown ? 300 : 80;
            }
          }

          // Wave equation step
          const damping = 0.975;
          for (let y = 1; y < lh - 1; y++) {
            const row = y * lw;
            for (let x = 1; x < lw - 1; x++) {
              const idx = row + x;
              liq.buffer2[idx] =
                (liq.buffer1[idx - 1] +
                  liq.buffer1[idx + 1] +
                  liq.buffer1[idx - lw] +
                  liq.buffer1[idx + lw]) *
                  0.5 -
                liq.buffer2[idx];
              liq.buffer2[idx] *= damping;
            }
          }

          // Swap buffers
          const temp = liq.buffer1;
          liq.buffer1 = liq.buffer2;
          liq.buffer2 = temp;

          // Draw water ripples with light prismatic refraction
          const cellScaleX = width / lw;
          const cellScaleY = height / lh;

          for (let y = 1; y < lh - 1; y += 2) {
            for (let x = 1; x < lw - 1; x += 2) {
              const val = liq.buffer1[y * lw + x];
              if (Math.abs(val) > 1.5) {
                const alpha = Math.min(0.65, Math.abs(val) / 120);
                const rx = x * cellScaleX;
                const ry = y * cellScaleY;
                ctx.beginPath();
                ctx.arc(rx, ry, Math.min(18, Math.abs(val) * 0.15 + 2), 0, Math.PI * 2);
                ctx.fillStyle = val > 0 ? PALETTES[palette].primary : '#0284c7';
                ctx.globalAlpha = alpha;
                ctx.fill();
              }
            }
          }
        }
      }

      // ---------------------------------------------------------
      // MODE 4: MAGNETIC COLORFUL SAND
      // ---------------------------------------------------------
      else if (mode === 'sand') {
        const sand = sandRef.current;
        const magnetActive = mouse.x !== -9999;
        const magnetForce = mouse.isDown ? -12 : 6; // Repel or Attract

        for (let s of sand) {
          if (magnetActive) {
            const dx = mouse.x - s.x;
            const dy = mouse.y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 260 && dist > 2) {
              const force = (1 - dist / 260) * magnetForce;
              s.vx += (dx / dist) * force * 0.18;
              s.vy += (dy / dist) * force * 0.18;
            }
          }

          s.x += s.vx;
          s.y += s.vy;
          s.vx *= 0.94;
          s.vy *= 0.94;

          // Wrap edges
          if (s.x < 0) s.x = width;
          if (s.x > width) s.x = 0;
          if (s.y < 0) s.y = height;
          if (s.y > height) s.y = 0;

          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.globalAlpha = 0.85;
          ctx.fill();
        }
      }

      // ---------------------------------------------------------
      // TOOL VISUALS & CURSOR RETICLE
      // ---------------------------------------------------------
      if (mouse.x !== -9999 && mouse.y !== -9999) {
        ctx.save();
        if (isCutting) {
          // Scissor cutting line
          if (mouse.prevX !== -9999 && mouse.isDown) {
            ctx.beginPath();
            ctx.moveTo(mouse.prevX, mouse.prevY);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 3;
            ctx.stroke();
          }

          // Razor reticle
          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, 14, 0, Math.PI * 2);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
        } else {
          // Hand / Grab Reticle
          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, mouse.isDown ? 18 : 22, 0, Math.PI * 2);
          ctx.strokeStyle = PALETTES[palette].primary;
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = PALETTES[palette].primary;
          ctx.fill();
        }
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [mode, activeTool, palette, handleResize, checkLineIntersection]);

  // Pointer Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    mouseRef.current.isDown = true;
    mouseRef.current.button = e.button;
    mouseRef.current.x = x;
    mouseRef.current.y = y;
    mouseRef.current.prevX = x;
    mouseRef.current.prevY = y;

    if (activeTool === 'blast') {
      triggerBlast(x, y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    mouseRef.current.prevX = mouseRef.current.x;
    mouseRef.current.prevY = mouseRef.current.y;
    mouseRef.current.x = x;
    mouseRef.current.y = y;
  };

  const handlePointerUp = () => {
    mouseRef.current.isDown = false;
    mouseRef.current.grabbedPoint = null;
    mouseRef.current.grabbedMarble = null;
  };

  const handlePointerLeave = () => {
    mouseRef.current.x = -9999;
    mouseRef.current.y = -9999;
    mouseRef.current.prevX = -9999;
    mouseRef.current.prevY = -9999;
    mouseRef.current.isDown = false;
    mouseRef.current.grabbedPoint = null;
    mouseRef.current.grabbedMarble = null;
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden transition-all duration-300 select-none ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-white flex flex-col justify-between'
          : 'rounded-2xl border border-gray-200/90 dark:border-[#2a3346] shadow-xl bg-white'
      }`}
      style={{ minHeight: isFullscreen ? '100vh' : '620px', height: isFullscreen ? '100vh' : '650px' }}
    >
      {/* Light Glassmorphism Control Header */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2.5 p-2 px-3 rounded-xl bg-white/90 dark:bg-[#1e2433]/90 backdrop-blur-md border border-gray-200/80 dark:border-white/10 shadow-md text-gray-800 dark:text-gray-100 text-xs">
        {/* Left: Mode Selection Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mr-1 hidden sm:inline flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-spin-reverse" /> Toy:
          </span>

          {[
            { id: 'cloth', label: 'Tearable Fabric', icon: Scissors, desc: 'Cut and swing real textile cloth' },
            { id: 'marbles', label: 'Jelly Marbles', icon: CircleDot, desc: 'Squishy bouncy soft-body balls' },
            { id: 'liquid', label: 'Liquid Ripples', icon: Waves, desc: 'Fluid wave splash simulation' },
            { id: 'sand', label: 'Magnetic Sand', icon: Magnet, desc: 'Fluid sand grains that pull & repel' },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = mode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setMode(item.id as GameMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 scale-105'
                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/15 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/5'
                }`}
                title={item.desc}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-emerald-600'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Center / Right: Interactive Tools & Actions */}
        <div className="flex items-center gap-2">
          {/* Active Tool Switcher (Especially for Tearable Cloth) */}
          <div className="flex items-center bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTool('drag')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                activeTool === 'drag'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
              title="Grab & Pull"
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Grab</span>
            </button>
            <button
              onClick={() => setActiveTool('cut')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                activeTool === 'cut'
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
              title="Slice & Cut Fabric / Pop Marbles (Right Click also works)"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Slice</span>
            </button>
            <button
              onClick={() => triggerBlast()}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition cursor-pointer"
              title="Trigger Blast Force"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Blast</span>
            </button>
          </div>

          {/* Palette Selector */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-1">
            <Palette className="w-3.5 h-3.5 text-emerald-600 ml-1" />
            <select
              value={palette}
              onChange={(e) => setPalette(e.target.value as PaletteTheme)}
              aria-label="Color Palette"
              className="bg-transparent text-gray-800 dark:text-white font-medium text-[11px] outline-none cursor-pointer pr-1"
            >
              {Object.entries(PALETTES).map(([key, val]) => (
                <option key={key} value={key} className="bg-white text-gray-900 dark:bg-slate-900 dark:text-white">
                  {val.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reset / Reweave */}
          <button
            onClick={initCurrentMode}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/15 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/10 font-bold transition cursor-pointer"
            title="Reset / Reweave canvas"
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => {
              setIsFullscreen((prev) => !prev);
              setTimeout(handleResize, 80);
            }}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/15 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/10 transition cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
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
        onContextMenu={(e) => e.preventDefault()} // Allow right-click slicing without browser menu
        className={`w-full h-full block touch-none ${activeTool === 'cut' ? 'cursor-crosshair' : 'cursor-grab'}`}
      />

      {/* Bottom Information & Live Stats Pill */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Interactive Instruction Hint */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/90 dark:bg-[#1e2433]/90 backdrop-blur-md border border-gray-200/80 dark:border-white/10 text-gray-700 dark:text-gray-200 text-[11px] font-medium shadow-sm">
          <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            {mode === 'cloth' &&
              '🧵 Left drag to swing fabric. Switch to "Slice" or Right-Click drag to cut threads into pieces!'}
            {mode === 'marbles' && '🔮 Drag & fling squishy jelly marbles! Collide them or click Blast to disperse.'}
            {mode === 'liquid' && '🌊 Move cursor or click to generate water ripples and prismatic refraction waves.'}
            {mode === 'sand' && '🧲 Move cursor to pull magnetic sand grains. Click to trigger repulsion blast!'}
          </span>
        </div>

        {/* Live FPS */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/90 dark:bg-[#1e2433]/90 backdrop-blur-md border border-gray-200/80 dark:border-white/10 text-gray-800 dark:text-gray-100 text-[11px] font-mono shadow-sm">
          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {fps} FPS
          </span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600 dark:text-gray-300 uppercase font-semibold text-[10px]">
            {mode} Mode
          </span>
        </div>
      </div>
    </div>
  );
}
