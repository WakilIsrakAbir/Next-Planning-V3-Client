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

export default function InteractivePlayground({ children }: { children?: React.ReactNode }) {
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

      {/* Foreground content (the planning overview) over the animated background */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-4 sm:p-6">{children}</div>
    </div>
  );
}
