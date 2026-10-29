'use client';

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  baseSize: number;
  vx: number;
  vy: number;
  color: string;
  pulse: number;
  pulseSpeed: number;
  wobble: number;
  wobbleSpeed: number;
  wobbleAmount: number;
}

export default function InteractivePlayground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number | null = null;
    let particles: Particle[] = [];
    const PARTICLE_COUNT = 40;

    const palettes = [
      'rgba(239, 68, 68, 0.15)', // red
      'rgba(245, 158, 11, 0.15)', // amber
      'rgba(16, 185, 129, 0.15)', // emerald
      'rgba(6, 182, 212, 0.15)', // cyan
      'rgba(168, 85, 247, 0.15)', // violet
      'rgba(236, 72, 153, 0.15)', // pink
      'rgba(59, 130, 246, 0.15)', // blue
      'rgba(234, 179, 8, 0.15)', // yellow
      'rgba(20, 184, 166, 0.15)', // teal
    ];

    function resize() {
      if (!canvas || !canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    function createParticle(): Particle {
      const size = Math.random() * 30 + 8;
      const w = canvas?.width || 800;
      const h = canvas?.height || 400;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        size: size,
        baseSize: size,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.3,
        color: palettes[Math.floor(Math.random() * palettes.length)],
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.005 + Math.random() * 0.01,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.002 + Math.random() * 0.005,
        wobbleAmount: Math.random() * 0.3,
      };
    }

    function initParticles() {
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(createParticle());
      }
    }

    function drawParticle(p: Particle) {
      if (!ctx) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }

    function drawConnections() {
      if (!ctx) return;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const opacity = (1 - dist / 120) * 0.06;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(99, 102, 241, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

    function animate() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const isDark = document.documentElement.classList.contains('dark');
      const grd = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        Math.max(canvas.width, canvas.height) * 0.6
      );
      if (isDark) {
        grd.addColorStop(0, 'rgba(255, 255, 255, 0.03)');
        grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
      } else {
        grd.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawConnections();

      particles.forEach((p) => {
        p.pulse += p.pulseSpeed;
        p.wobble += p.wobbleSpeed;
        p.size = p.baseSize + Math.sin(p.pulse) * 3;
        p.vx += Math.sin(p.wobble) * p.wobbleAmount * 0.01;
        p.vy += Math.cos(p.wobble) * p.wobbleAmount * 0.01;

        // Dampen velocity
        p.vx *= 0.999;
        p.vy *= 0.999;

        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges smoothly
        if (p.x < -p.size) p.x = canvas.width + p.size;
        if (p.x > canvas.width + p.size) p.x = -p.size;
        if (p.y < -p.size) p.y = canvas.height + p.size;
        if (p.y > canvas.height + p.size) p.y = -p.size;

        drawParticle(p);
      });

      animFrame = requestAnimationFrame(animate);
    }

    resize();
    initParticles();
    animate();

    const handleWindowResize = () => {
      resize();
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      if (animFrame) {
        cancelAnimationFrame(animFrame);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-slate-100 dark:bg-[#1a202c] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/60 overflow-hidden flex flex-col min-h-[350px] relative transition-colors duration-300"
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} />

      <div className="relative z-10 flex flex-col items-center justify-center flex-1 p-6 pointer-events-none select-none my-auto">
        <div id="dashboardAnimIcon" className="mb-5 animate-breathe">
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
            <circle cx="60" cy="60" r="54" stroke="url(#dashGrad1)" strokeWidth="2.5" fill="none" opacity="0.6">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 60 60"
                to="360 60 60"
                dur="20s"
                repeatCount="indefinite"
              />
            </circle>
            <circle cx="60" cy="60" r="40" stroke="url(#dashGrad2)" strokeWidth="2" fill="none" opacity="0.5" strokeDasharray="6 8">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="360 60 60"
                to="0 60 60"
                dur="15s"
                repeatCount="indefinite"
              />
            </circle>
            <circle cx="60" cy="60" r="26" stroke="url(#dashGrad1)" strokeWidth="1.5" fill="none" opacity="0.4" strokeDasharray="3 5">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 60 60"
                to="360 60 60"
                dur="10s"
                repeatCount="indefinite"
              />
            </circle>
            <circle cx="60" cy="60" r="14" stroke="url(#dashGrad3)" strokeWidth="1" fill="none" opacity="0.35" strokeDasharray="2 3">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="360 60 60"
                to="0 60 60"
                dur="8s"
                repeatCount="indefinite"
              />
            </circle>
            <circle cx="60" cy="60" r="7" fill="url(#dashGrad2)" opacity="0.7">
              <animate attributeName="r" values="5;9;5" dur="3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0.9;0.5" dur="3s" repeatCount="indefinite" />
            </circle>
            <defs>
              <linearGradient id="dashGrad1" x1="0" y1="0" x2="120" y2="120">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="100%" stopColor="#0891b2" />
              </linearGradient>
              <linearGradient id="dashGrad2" x1="0" y1="120" x2="120" y2="0">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
              <linearGradient id="dashGrad3" x1="0" y1="0" x2="120" y2="0">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <p className="text-gray-700 dark:text-gray-200 text-base font-semibold tracking-wide animate-fadeInUp">
          Your Planning Dashboard Is Ready!
        </p>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 animate-fadeInUp">
          Navigate the sidebar to start planning
        </p>
      </div>
    </div>
  );
}
