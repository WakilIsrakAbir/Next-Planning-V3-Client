'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Sparkles,
  Waves,
  Orbit,
  Network,
  Flame,
  Zap,
  RotateCcw,
  Maximize2,
  Minimize2,
  Sliders,
  Palette,
  Info,
} from 'lucide-react';

type PlayMode = 'vortex' | 'fabric' | 'constellation' | 'supernova' | 'liquid';
type ColorTheme = 'emerald' | 'cyber' | 'solar' | 'cosmic' | 'rainbow';

interface Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  color: string;
  hue: number;
  alpha: number;
  angle: number;
  speed: number;
  mass: number;
  life: number;
  maxLife: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  force: number;
  alpha: number;
  color: string;
}

const THEMES: Record<ColorTheme, { name: string; colors: string[] }> = {
  emerald: {
    name: 'Emerald Matrix',
    colors: ['#10b981', '#34d399', '#059669', '#6ee7b7', '#047857', '#a7f3d0'],
  },
  cyber: {
    name: 'Cyberpunk Neon',
    colors: ['#06b6d4', '#3b82f6', '#ec4899', '#8b5cf6', '#f43f5e', '#a855f7'],
  },
  solar: {
    name: 'Solar Flare',
    colors: ['#f59e0b', '#fbbf24', '#f97316', '#ef4444', '#fde047', '#ffedd5'],
  },
  cosmic: {
    name: 'Deep Aurora',
    colors: ['#818cf8', '#c084fc', '#e879f9', '#38bdf8', '#6366f1', '#4f46e5'],
  },
  rainbow: {
    name: 'Spectrum Prism',
    colors: ['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899'],
  },
};

export default function InteractivePlayground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // States
  const [mode, setMode] = useState<PlayMode>('vortex');
  const [theme, setTheme] = useState<ColorTheme>('emerald');
  const [particleCount, setParticleCount] = useState<number>(850);
  const [gravity, setGravity] = useState<number>(0.8);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(60);
  const [mouseVelocity, setMouseVelocity] = useState<number>(0);

  // Refs for animation loop
  const animFrameRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const mouseRef = useRef<{
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    isDown: boolean;
    speed: number;
    radius: number;
  }>({
    x: -9999,
    y: -9999,
    prevX: -9999,
    prevY: -9999,
    isDown: false,
    speed: 0,
    radius: 140,
  });

  // Track FPS
  const fpsTrackerRef = useRef<{ frames: number; lastTime: number }>({
    frames: 0,
    lastTime: performance.now(),
  });

  // Colors getter
  const getThemeColor = useCallback(
    (index: number, total: number, time: number) => {
      const colors = THEMES[theme].colors;
      if (theme === 'rainbow') {
        const hue = (time * 40 + (index / total) * 360) % 360;
        return `hsl(${hue}, 90%, 60%)`;
      }
      return colors[index % colors.length];
    },
    [theme]
  );

  // Initialize Particles based on Mode
  const initParticles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    const particles: Particle[] = [];
    const count = particleCount;

    if (mode === 'fabric') {
      // Create elastic grid weave (Warp & Weft textile mesh)
      const cols = Math.floor(Math.sqrt(count * 1.5));
      const rows = Math.floor(count / cols);
      const stepX = w / (cols + 1);
      const stepY = h / (rows + 1);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = (c + 1) * stepX;
          const y = (r + 1) * stepY;
          particles.push({
            x,
            y,
            originX: x,
            originY: y,
            vx: 0,
            vy: 0,
            radius: 2.2,
            baseRadius: 2.2,
            color: getThemeColor(c + r, cols + rows, 0),
            hue: (c * 15 + r * 15) % 360,
            alpha: 0.85,
            angle: 0,
            speed: 0,
            mass: 1,
            life: 1,
            maxLife: 1,
          });
        }
      }
    } else {
      // Normal / Vortex / Constellation / Liquid / Supernova distributions
      for (let i = 0; i < count; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 0.5;
        const radius = Math.random() * 2.5 + 1.2;

        particles.push({
          x,
          y,
          originX: x,
          originY: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius,
          baseRadius: radius,
          color: getThemeColor(i, count, 0),
          hue: Math.random() * 360,
          alpha: Math.random() * 0.7 + 0.3,
          angle,
          speed,
          mass: Math.random() * 1.5 + 0.8,
          life: Math.random() * 100,
          maxLife: 100,
        });
      }
    }

    particlesRef.current = particles;
  }, [mode, particleCount, getThemeColor]);

  // Handle Resize
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = isFullscreen ? window.innerHeight : Math.max(540, container.clientHeight);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    initParticles();
  }, [isFullscreen, initParticles]);

  // Trigger Shockwave Burst
  const triggerShockwave = useCallback(
    (x?: number, y?: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);

      const targetX = x !== undefined ? x : w / 2;
      const targetY = y !== undefined ? y : h / 2;

      shockwavesRef.current.push({
        x: targetX,
        y: targetY,
        radius: 5,
        maxRadius: 280,
        force: 18 * gravity,
        alpha: 1,
        color: THEMES[theme].colors[Math.floor(Math.random() * THEMES[theme].colors.length)],
      });

      // Also spawn transient sparks on explosion
      const sparkCount = 35;
      for (let i = 0; i < sparkCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = Math.random() * 12 + 4;
        particlesRef.current.push({
          x: targetX,
          y: targetY,
          originX: targetX,
          originY: targetY,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          radius: Math.random() * 3 + 2,
          baseRadius: 2,
          color: '#ffffff',
          hue: Math.random() * 360,
          alpha: 1,
          angle,
          speed: spd,
          mass: 0.5,
          life: 0,
          maxLife: 40,
        });
      }
    },
    [gravity, theme]
  );

  // Main Render and Physics Simulation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTimestamp = performance.now();

    const animate = (timestamp: number) => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // Track FPS
      fpsTrackerRef.current.frames++;
      if (timestamp - fpsTrackerRef.current.lastTime >= 600) {
        setFps(Math.round((fpsTrackerRef.current.frames * 1000) / (timestamp - fpsTrackerRef.current.lastTime)));
        fpsTrackerRef.current.frames = 0;
        fpsTrackerRef.current.lastTime = timestamp;
      }

      // Smooth clear with alpha fade to generate luminous neon motion trails
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(10, 15, 26, 0.22)';
      ctx.fillRect(0, 0, width, height);

      // Light glow blending mode for cosmic radiance
      ctx.globalCompositeOperation = 'lighter';

      const mouse = mouseRef.current;
      const particles = particlesRef.current;
      const shockwaves = shockwavesRef.current;
      const timeSec = timestamp * 0.001;

      // 1. Process Active Shockwaves
      for (let sIdx = shockwaves.length - 1; sIdx >= 0; sIdx--) {
        const sw = shockwaves[sIdx];
        sw.radius += 10;
        sw.alpha -= 0.035;

        ctx.save();
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 3 * sw.alpha;
        ctx.globalAlpha = Math.max(0, sw.alpha);
        ctx.stroke();
        ctx.restore();

        // Displace particles on shockwave front
        for (let p of particles) {
          const dx = p.x - sw.x;
          const dy = p.y - sw.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (Math.abs(dist - sw.radius) < 30) {
            const push = (sw.force * sw.alpha) / (dist || 1);
            p.vx += dx * push * 0.15;
            p.vy += dy * push * 0.15;
          }
        }

        if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
          shockwaves.splice(sIdx, 1);
        }
      }

      // 2. Physics & Draw per Mode
      if (mode === 'fabric') {
        // --- TEXTILE YARN WEAVE MODE ---
        ctx.lineWidth = 1;
        const cols = Math.floor(Math.sqrt(particles.length * 1.5));

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          // Elastic spring pulling back to origin
          const k = 0.035;
          const damping = 0.88;
          const ax = (p.originX - p.x) * k;
          const ay = (p.originY - p.y) * k;

          p.vx = (p.vx + ax) * damping;
          p.vy = (p.vy + ay) * damping;

          // Mouse distortion: Pluck and push fabric threads
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = mouse.radius * 0.9;

          if (dist < maxDist && dist > 0) {
            const force = (1 - dist / maxDist) * 14 * gravity;
            const angle = Math.atan2(dy, dx);
            p.vx -= Math.cos(angle) * force;
            p.vy -= Math.sin(angle) * force;
            p.radius = p.baseRadius * 1.8;
          } else {
            p.radius = Math.max(p.baseRadius, p.radius * 0.96);
          }

          p.x += p.vx;
          p.y += p.vy;

          // Draw interconnecting warp & weft weave lines
          const rightIdx = i + 1;
          const downIdx = i + cols;

          if (rightIdx < particles.length && (i + 1) % cols !== 0) {
            const pRight = particles[rightIdx];
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(pRight.x, pRight.y);
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = 0.35;
            ctx.stroke();
          }

          if (downIdx < particles.length) {
            const pDown = particles[downIdx];
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(pDown.x, pDown.y);
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = 0.35;
            ctx.stroke();
          }

          // Node bead
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = 0.85;
          ctx.fill();
        }
      } else if (mode === 'constellation') {
        // --- COSMIC CONSTELLATION WEB MODE ---
        const connectionDistance = 85;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          // Natural organic drift
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;

          // Connect with mouse
          const mdx = mouse.x - p.x;
          const mdy = mouse.y - p.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

          if (mdist < mouse.radius) {
            const mAlpha = 1 - mdist / mouse.radius;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = '#ffffff';
            ctx.globalAlpha = mAlpha * 0.7;
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Gentle gravity to cursor
            p.vx += (mdx / mdist) * 0.18 * gravity;
            p.vy += (mdy / mdist) * 0.18 * gravity;
            p.vx *= 0.94;
            p.vy *= 0.94;
          }

          // Connect with adjacent nodes
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < connectionDistance) {
              const alpha = (1 - dist / connectionDistance) * 0.5;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = p.color;
              ctx.globalAlpha = alpha;
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }
          }

          // Draw node
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = 0.9;
          ctx.fill();
        }
      } else if (mode === 'vortex') {
        // --- VORTEX GRAVITY / WHIRLPOOL MODE ---
        const cx = mouse.x !== -9999 ? mouse.x : width / 2;
        const cy = mouse.y !== -9999 ? mouse.y : height / 2;

        for (let p of particles) {
          const dx = cx - p.x;
          const dy = cy - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          // Gravitational pull + perpendicular orbital swirl force
          const pullForce = (350 / (dist + 80)) * 0.08 * gravity;
          const orbitAngle = Math.atan2(dy, dx) + Math.PI / 2;

          p.vx += Math.cos(orbitAngle) * (pullForce * 1.6) + (dx / dist) * pullForce;
          p.vy += Math.sin(orbitAngle) * (pullForce * 1.6) + (dy / dist) * pullForce;

          // Viscous damping
          p.vx *= 0.96;
          p.vy *= 0.96;

          p.x += p.vx;
          p.y += p.vy;

          // Respawn if collapsed into center
          if (dist < 15) {
            const escapeAngle = Math.random() * Math.PI * 2;
            const escapeDist = Math.random() * (width * 0.45) + 80;
            p.x = cx + Math.cos(escapeAngle) * escapeDist;
            p.y = cy + Math.sin(escapeAngle) * escapeDist;
            p.vx = (Math.random() - 0.5) * 2;
            p.vy = (Math.random() - 0.5) * 2;
          }

          // Render glowing particle
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.min(1, 0.3 + 25 / dist);
          ctx.fill();
        }
      } else if (mode === 'supernova') {
        // --- SUPERNOVA & FIREWORK FOUNTAIN MODE ---
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.08; // Gravity downwards
          p.vx *= 0.985;
          p.vy *= 0.985;

          p.life++;
          const lifeAlpha = 1 - p.life / p.maxLife;

          if (p.x < 0 || p.x > width) p.vx *= -0.7;
          if (p.y > height) {
            p.y = height;
            p.vy *= -0.6;
          }

          // Interactive push from mouse movement
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 90 && dist > 0) {
            const push = ((90 - dist) / 90) * 8 * gravity;
            p.vx += (dx / dist) * push;
            p.vy += (dy / dist) * push;
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.8, p.radius * lifeAlpha), 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, lifeAlpha);
          ctx.fill();

          // Respawn exhausted particles at cursor or random fountain
          if (p.life >= p.maxLife) {
            p.x = mouse.x !== -9999 ? mouse.x : width / 2;
            p.y = mouse.y !== -9999 ? mouse.y : height / 2;
            const angle = Math.random() * Math.PI * 2;
            const spd = Math.random() * 6 + 1.5;
            p.vx = Math.cos(angle) * spd;
            p.vy = Math.sin(angle) * spd;
            p.life = 0;
            p.color = getThemeColor(i, particles.length, timeSec);
          }
        }
      } else if (mode === 'liquid') {
        // --- LIQUID FLUID WAVE MODE ---
        for (let p of particles) {
          // Flow noise field
          const noiseAngle = Math.sin(p.x * 0.005 + timeSec) * Math.cos(p.y * 0.005 + timeSec) * Math.PI * 2;
          p.vx += Math.cos(noiseAngle) * 0.25;
          p.vy += Math.sin(noiseAngle) * 0.25;

          // Mouse wake repulsion
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < mouse.radius && dist > 0) {
            const force = (1 - dist / mouse.radius) * 6 * gravity;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
            p.radius = p.baseRadius * 1.7;
          } else {
            p.radius = Math.max(p.baseRadius, p.radius * 0.98);
          }

          p.vx *= 0.94;
          p.vy *= 0.94;

          p.x += p.vx;
          p.y += p.vy;

          // Wrap edges smoothly
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = 0.75;
          ctx.fill();
        }
      }

      // Draw Cursor Reticle / Force Field Glow
      if (mouse.x !== -9999 && mouse.y !== -9999) {
        const ringRadius = mouse.isDown ? 30 : 20 + Math.sin(timeSec * 6) * 4;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = THEMES[theme].colors[0];
        ctx.lineWidth = mouse.isDown ? 3 : 1.5;
        ctx.globalAlpha = 0.8;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.9;
        ctx.fill();
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
  }, [mode, theme, gravity, handleResize, getThemeColor]);

  // Mouse / Touch Event Handlers
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const mouse = mouseRef.current;
    if (mouse.prevX !== -9999) {
      const dx = x - mouse.prevX;
      const dy = y - mouse.prevY;
      const speed = Math.sqrt(dx * dx + dy * dy);
      mouse.speed = speed;
      setMouseVelocity(Math.round(speed * 10));
    }

    mouse.prevX = mouse.x;
    mouse.prevY = mouse.y;
    mouse.x = x;
    mouse.y = y;

    // Continuous spark spray on drag
    if (mouse.isDown && mode === 'supernova') {
      triggerShockwave(x, y);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    mouseRef.current.isDown = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    triggerShockwave(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handlePointerUp = () => {
    mouseRef.current.isDown = false;
  };

  const handlePointerLeave = () => {
    mouseRef.current.x = -9999;
    mouseRef.current.y = -9999;
    mouseRef.current.prevX = -9999;
    mouseRef.current.prevY = -9999;
    mouseRef.current.isDown = false;
    setMouseVelocity(0);
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
    setTimeout(handleResize, 80);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden transition-all duration-300 select-none ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-[#0a0f1a] flex flex-col justify-between'
          : 'rounded-2xl border border-gray-200 dark:border-[#2a3346] shadow-2xl bg-[#0a0f1a]'
      }`}
      style={{ minHeight: isFullscreen ? '100vh' : '620px', height: isFullscreen ? '100vh' : '650px' }}
    >
      {/* Interactive Top Control Bar with Glassmorphism */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2.5 p-2 px-3 rounded-xl bg-slate-900/75 dark:bg-[#121826]/85 backdrop-blur-md border border-white/10 shadow-lg text-white text-xs">
        {/* Left: Mode Switcher Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-gray-400 mr-1 hidden sm:inline flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-spin-reverse" /> Mode:
          </span>

          {[
            { id: 'vortex', label: 'Vortex Gravity', icon: Orbit },
            { id: 'fabric', label: 'Textile Weave', icon: Waves },
            { id: 'constellation', label: 'Constellation', icon: Network },
            { id: 'supernova', label: 'Supernova Burst', icon: Flame },
            { id: 'liquid', label: 'Liquid Waves', icon: Zap },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = mode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setMode(item.id as PlayMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30 scale-105'
                    : 'bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white border border-white/5'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-emerald-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Actions, Palette, Sliders, Fullscreen */}
        <div className="flex items-center gap-2">
          {/* Theme Selector */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
            <Palette className="w-3.5 h-3.5 text-emerald-400 ml-1" />
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as ColorTheme)}
              aria-label="Color Theme"
              className="bg-transparent text-white font-medium text-[11px] outline-none cursor-pointer pr-1"
            >
              {Object.entries(THEMES).map(([key, val]) => (
                <option key={key} value={key} className="bg-slate-900 text-white">
                  {val.name}
                </option>
              ))}
            </select>
          </div>

          {/* Trigger Blast */}
          <button
            onClick={() => triggerShockwave()}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold transition cursor-pointer"
            title="Detonate Energy Blast"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">Blast</span>
          </button>

          {/* Toggle Physics Controls Drawer */}
          <button
            onClick={() => setShowSettings((prev) => !prev)}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              showSettings
                ? 'bg-emerald-600 text-white border-emerald-400'
                : 'bg-white/5 hover:bg-white/15 text-gray-300 border-white/10'
            }`}
            title="Adjust Gravity & Density"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 border border-white/10 transition cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Physics Settings Drawer (Expandable) */}
      {showSettings && (
        <div className="absolute top-16 right-3 z-20 w-64 p-3 rounded-xl bg-slate-900/90 dark:bg-[#121826]/95 backdrop-blur-md border border-white/15 shadow-2xl text-white text-xs space-y-3 animate-fade-in">
          <div className="flex items-center justify-between font-bold border-b border-white/10 pb-1.5">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Sliders className="w-3.5 h-3.5" /> Physics Engine
            </span>
            <button
              onClick={() => {
                setGravity(0.8);
                setParticleCount(850);
                initParticles();
              }}
              className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-gray-300 font-medium">
              <span>Gravity Force:</span>
              <span className="text-emerald-400 font-mono">{gravity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="2.5"
              step="0.1"
              value={gravity}
              onChange={(e) => setGravity(parseFloat(e.target.value))}
              aria-label="Gravity Force"
              className="w-full accent-emerald-500 cursor-pointer h-1.5 rounded-lg bg-white/20"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-gray-300 font-medium">
              <span>Particle Density:</span>
              <span className="text-emerald-400 font-mono">{particleCount}</span>
            </div>
            <input
              type="range"
              min="200"
              max="1600"
              step="50"
              value={particleCount}
              onChange={(e) => setParticleCount(parseInt(e.target.value))}
              aria-label="Particle Density"
              className="w-full accent-emerald-500 cursor-pointer h-1.5 rounded-lg bg-white/20"
            />
          </div>
        </div>
      )}

      {/* Main High-Performance HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className="w-full h-full block cursor-crosshair touch-none"
      />

      {/* Bottom Live HUD Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Interaction Hint */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/75 dark:bg-[#121826]/80 backdrop-blur-md border border-white/10 text-white text-[11px] font-medium shadow-md">
          <Info className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            {mode === 'fabric' && '🧵 Move cursor through yarn threads to pluck and stretch the textile weave!'}
            {mode === 'vortex' && '🌀 Move mouse to swirl gravitational whirlpool. Click to trigger shockwaves!'}
            {mode === 'constellation' && '🌌 Nodes snap filament connections to your cursor in real-time.'}
            {mode === 'supernova' && '💥 Click and drag anywhere to fire cosmic particle supernovas!'}
            {mode === 'liquid' && '🌊 Glide mouse to create neon fluid ripples across the screen.'}
          </span>
        </div>

        {/* Live Metrics */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/75 dark:bg-[#121826]/80 backdrop-blur-md border border-white/10 text-white text-[11px] font-mono shadow-md">
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            {fps} FPS
          </span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-300">{particleCount} Particles</span>
          {mouseVelocity > 0 && (
            <>
              <span className="text-gray-500">|</span>
              <span className="text-cyan-400">{mouseVelocity} px/s</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
