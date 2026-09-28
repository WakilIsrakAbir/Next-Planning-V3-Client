'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Gauge,
  Flag,
  Sun,
  Sunset,
  CloudSun,
  Sparkles,
  Zap,
} from 'lucide-react';

interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
}

interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
}

interface Bird {
  x: number;
  y: number;
  speed: number;
  wingAngle: number;
  wingSpeed: number;
}

type CarColor = 'emerald' | 'red' | 'blue' | 'amber';
type TimeOfDay = 'day' | 'sunset' | 'morning';

export default function InteractivePlayground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // UI state
  const [carColor, setCarColor] = useState<CarColor>('emerald');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day');
  const [isGasPressed, setIsGasPressed] = useState<boolean>(false);
  const [isBrakePressed, setIsBrakePressed] = useState<boolean>(false);
  const [speedKmH, setSpeedKmH] = useState<number>(45);
  const [distanceMeters, setDistanceMeters] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [airTimeText, setAirTimeText] = useState<string | null>(null);

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);
  const hornGainRef = useRef<GainNode | null>(null);

  // Car Physics State
  const carRef = useRef({
    worldX: 120,
    y: 350,
    vy: 0,
    speed: 5.5,
    maxSpeed: 14.5,
    cruiseSpeed: 5.5,
    minSpeed: 1.5,
    acceleration: 0.18,
    friction: 0.05,
    angle: 0,
    angularVelocity: 0,
    wheelAngle: 0,
    wheelBase: 50,
    wheelRadius: 11,
    inAir: false,
    airTimeFrames: 0,
    suspensionOffset: 0,
    suspensionVelocity: 0,
    hornPopup: 0, // horn bubble timer
  });

  // Camera State
  const cameraRef = useRef({
    x: 0,
    y: 0,
  });

  // Particles
  const smokeParticlesRef = useRef<SmokeParticle[]>([]);
  const dustParticlesRef = useRef<DustParticle[]>([]);

  // Birds in sky
  const birdsRef = useRef<Bird[]>([
    { x: 200, y: 80, speed: 1.5, wingAngle: 0, wingSpeed: 0.15 },
    { x: 380, y: 120, speed: 1.2, wingAngle: 1, wingSpeed: 0.12 },
    { x: 620, y: 70, speed: 1.8, wingAngle: 2, wingSpeed: 0.18 },
  ]);

  // Keys pressed
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // -------------------------------------------------------------
  // PROCEDURAL TERRAIN HEIGHT FUNCTIONS
  // -------------------------------------------------------------
  const getGroundY = (wx: number): number => {
    // Continuous smooth rolling hills (safe slope)
    return (
      360 +
      Math.sin(wx * 0.0016) * 75 +
      Math.cos(wx * 0.0038 + 1.1) * 38 +
      Math.sin(wx * 0.0085 + 2.4) * 14 +
      Math.sin(wx * 0.0005) * 60
    );
  };

  const getMidgroundY = (wx: number): number => {
    return 290 + Math.sin(wx * 0.001) * 90 + Math.cos(wx * 0.0025 + 2.0) * 45;
  };

  const getFarMountainY = (wx: number): number => {
    return 220 + Math.sin(wx * 0.0006) * 110 + Math.cos(wx * 0.0015) * 55;
  };

  // Deterministic random for roadside trees and scenery
  const pseudoRandom = (seed: number) => {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  // Web Audio Horn
  const playHorn = () => {
    carRef.current.hornPopup = 60; // show "BEEP BEEP!" bubble for 60 frames
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(466, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Jump Action
  const triggerJump = useCallback(() => {
    const car = carRef.current;
    if (!car.inAir) {
      car.vy = -7.5;
      car.inAir = true;
      car.suspensionVelocity = 4;
      setAirTimeText('Jump! 🚀');
      setTimeout(() => setAirTimeText(null), 1000);
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        triggerJump();
      }
      if (e.code === 'KeyH') {
        playHorn();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [triggerJump]);

  // Handle Resize
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = 520;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Reset Car Position
  const resetCar = () => {
    carRef.current.worldX = 120;
    carRef.current.speed = carRef.current.cruiseSpeed;
    carRef.current.vy = 0;
    carRef.current.inAir = false;
    setDistanceMeters(0);
  };

  // -------------------------------------------------------------
  // MAIN ANIMATION LOOP
  // -------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let frameCount = 0;

    const carColorsMap: Record<CarColor, { body: string; bodyDark: string; highlight: string }> = {
      emerald: { body: '#059669', bodyDark: '#047857', highlight: '#34d399' },
      red: { body: '#dc2626', bodyDark: '#b91c1c', highlight: '#f87171' },
      blue: { body: '#2563eb', bodyDark: '#1d4ed8', highlight: '#60a5fa' },
      amber: { body: '#d97706', bodyDark: '#b45309', highlight: '#fbbf24' },
    };

    const render = () => {
      frameCount++;
      const dpr = window.devicePixelRatio || 1;
      const screenW = canvas.width / dpr;
      const screenH = canvas.height / dpr;

      const car = carRef.current;
      const keys = keysRef.current;

      // 1. CAR SPEED & CONTROLS
      const isAccelerating =
        isGasPressed ||
        keys['ArrowRight'] ||
        keys['KeyD'] ||
        keys['Space'];
      const isBraking = isBrakePressed || keys['ArrowLeft'] || keys['KeyA'];

      if (isAccelerating) {
        car.speed = Math.min(car.speed + car.acceleration, car.maxSpeed);
      } else if (isBraking) {
        car.speed = Math.max(car.speed - car.acceleration * 1.5, car.minSpeed);
      } else {
        // Naturally return towards cruising speed
        if (car.speed > car.cruiseSpeed) {
          car.speed = Math.max(car.speed - car.friction, car.cruiseSpeed);
        } else if (car.speed < car.cruiseSpeed) {
          car.speed = Math.min(car.speed + car.friction * 0.5, car.cruiseSpeed);
        }
      }

      // Update world position
      car.worldX += car.speed;
      car.wheelAngle += car.speed / car.wheelRadius;

      // Ground physics calculation
      const rearX = car.worldX - car.wheelBase / 2;
      const frontX = car.worldX + car.wheelBase / 2;
      const rearGroundY = getGroundY(rearX);
      const frontGroundY = getGroundY(frontX);

      const groundCenterY = (rearGroundY + frontGroundY) / 2 - car.wheelRadius;
      const groundSlopeAngle = Math.atan2(frontGroundY - rearGroundY, car.wheelBase);

      // Suspension spring physics
      car.suspensionVelocity += (0 - car.suspensionOffset) * 0.2 - car.suspensionVelocity * 0.15;
      car.suspensionOffset += car.suspensionVelocity;

      // Vertical positioning & air jump physics
      if (!car.inAir) {
        // Check if car crests a hill fast enough to launch
        const slopeDiff = groundCenterY - car.y;
        if (slopeDiff > 8 && car.speed > 8) {
          car.inAir = true;
          car.vy = -car.speed * 0.28;
        } else {
          car.y = groundCenterY + car.suspensionOffset;
          // Smooth rotation to match ground slope
          car.angle += (groundSlopeAngle - car.angle) * 0.2;
        }
      } else {
        // Airborne
        car.airTimeFrames++;
        car.vy += 0.38; // gravity
        car.y += car.vy;

        // Slight rotation in air
        car.angle += 0.01;

        // Landing check
        if (car.y >= groundCenterY) {
          car.y = groundCenterY;
          car.suspensionVelocity = Math.min(car.vy * 0.7, 7);
          car.vy = 0;
          car.inAir = false;

          // Landing dust puff
          for (let d = 0; d < 8; d++) {
            dustParticlesRef.current.push({
              x: car.worldX + (Math.random() - 0.5) * 30,
              y: car.y + car.wheelRadius,
              vx: (Math.random() - 0.5) * 3 - car.speed * 0.3,
              vy: -Math.random() * 2 - 1,
              radius: Math.random() * 4 + 2,
              alpha: 0.7,
            });
          }

          if (car.airTimeFrames > 25) {
            setAirTimeText('Smooth Landing! 🎯');
            setTimeout(() => setAirTimeText(null), 1200);
          }
          car.airTimeFrames = 0;
        }
      }

      // Update HUD metrics
      if (frameCount % 6 === 0) {
        setSpeedKmH(Math.round(car.speed * 8));
        setDistanceMeters(Math.floor(car.worldX / 10));
      }

      // 2. CAMERA TRACKING
      // Camera smoothly centers around car (keeps car at ~32% from left)
      const targetCamX = car.worldX - screenW * 0.32;
      const targetCamY = car.y - screenH * 0.62;
      cameraRef.current.x += (targetCamX - cameraRef.current.x) * 0.12;
      cameraRef.current.y += (targetCamY - cameraRef.current.y) * 0.08;

      const camX = cameraRef.current.x;
      const camY = cameraRef.current.y;

      // 3. EXHAUST SMOKE & DUST PARTICLES
      if (frameCount % (isAccelerating ? 2 : 4) === 0) {
        const cosA = Math.cos(car.angle);
        const sinA = Math.sin(car.angle);
        const pipeLocalX = -car.wheelBase / 2 - 14;
        const pipeLocalY = 4;
        const pipeX = car.worldX + pipeLocalX * cosA - pipeLocalY * sinA;
        const pipeY = car.y + pipeLocalX * sinA + pipeLocalY * cosA;

        smokeParticlesRef.current.push({
          x: pipeX,
          y: pipeY,
          vx: -car.speed * 0.4 - Math.random() * 1.5,
          vy: -Math.random() * 1.2 - 0.5,
          radius: isAccelerating ? 5 : 3.5,
          alpha: 0.65,
          color: isAccelerating ? '#fbbf24' : '#cbd5e1',
        });
      }

      // Wheel ground dust
      if (!car.inAir && car.speed > 4 && frameCount % 3 === 0) {
        dustParticlesRef.current.push({
          x: rearX - 4,
          y: rearGroundY,
          vx: -car.speed * 0.3 - Math.random() * 1.2,
          vy: -Math.random() * 1.5 - 0.3,
          radius: Math.random() * 3 + 2,
          alpha: 0.5,
        });
      }

      // -------------------------------------------------------------
      // DRAW BACKGROUND SKY & ENVIRONMENT
      // -------------------------------------------------------------
      ctx.clearRect(0, 0, screenW, screenH);

      // Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, screenH);
      if (timeOfDay === 'day') {
        skyGrad.addColorStop(0, '#bae6fd'); // bright sky blue
        skyGrad.addColorStop(0.55, '#e0f2fe');
        skyGrad.addColorStop(1, '#f0fdf4'); // soft mint horizon
      } else if (timeOfDay === 'sunset') {
        skyGrad.addColorStop(0, '#fb7185'); // rose coral
        skyGrad.addColorStop(0.4, '#fdba74'); // amber
        skyGrad.addColorStop(1, '#fef08a'); // golden horizon
      } else {
        // Morning
        skyGrad.addColorStop(0, '#c7d2fe'); // lavender blue
        skyGrad.addColorStop(0.5, '#fed7aa'); // peach
        skyGrad.addColorStop(1, '#fef9c3'); // soft lemon
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, screenW, screenH);

      // Sun
      const sunX = screenW * 0.82;
      const sunY = screenH * 0.22;
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 15, sunX, sunY, 80);
      sunGlow.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
      sunGlow.addColorStop(0.4, 'rgba(253, 224, 71, 0.4)');
      sunGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 80, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
      ctx.fill();

      // Puffy Clouds (Parallax Layer 0.05)
      const cloudOffset = camX * 0.05;
      const cloudYOffset = camY * 0.03;
      const drawCloud = (cx: number, cy: number, scale: number) => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(cx, cy, 22 * scale, 0, Math.PI * 2);
        ctx.arc(cx + 18 * scale, cy - 10 * scale, 26 * scale, 0, Math.PI * 2);
        ctx.arc(cx + 42 * scale, cy - 6 * scale, 22 * scale, 0, Math.PI * 2);
        ctx.arc(cx + 60 * scale, cy + 2 * scale, 18 * scale, 0, Math.PI * 2);
        ctx.fill();
      };

      for (let c = -1; c < 5; c++) {
        const cloudBaseX = ((c * 400 - cloudOffset) % (screenW + 500)) - 100;
        const adjustedX = cloudBaseX < -200 ? cloudBaseX + screenW + 500 : cloudBaseX;
        drawCloud(adjustedX, 85 - cloudYOffset, 1.0);
        drawCloud(adjustedX + 240, 140 - cloudYOffset, 0.75);
      }

      // Birds in sky
      birdsRef.current.forEach((bird) => {
        bird.x += bird.speed;
        if (bird.x > screenW + 60) bird.x = -60;
        bird.wingAngle += bird.wingSpeed;

        const wingH = Math.sin(bird.wingAngle) * 5;
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(bird.x - 8, bird.y + wingH);
        ctx.quadraticCurveTo(bird.x - 4, bird.y - 4, bird.x, bird.y);
        ctx.quadraticCurveTo(bird.x + 4, bird.y - 4, bird.x + 8, bird.y + wingH);
        ctx.stroke();
      });

      // -------------------------------------------------------------
      // PARALLAX LAYER 1: FAR MOUNTAINS (Light Pastel Blue/Lilac)
      // -------------------------------------------------------------
      const farMountainColor =
        timeOfDay === 'day'
          ? '#cbd5e1'
          : timeOfDay === 'sunset'
          ? '#e0a9af'
          : '#c4b5fd';
      ctx.fillStyle = farMountainColor;
      ctx.beginPath();
      ctx.moveTo(0, screenH);
      for (let x = 0; x <= screenW; x += 15) {
        const worldPos = x + camX * 0.18;
        const y = getFarMountainY(worldPos) - camY * 0.18;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(screenW, screenH);
      ctx.closePath();
      ctx.fill();

      // -------------------------------------------------------------
      // PARALLAX LAYER 2: MIDGROUND HILLS & WINDMILLS (Mint / Sage)
      // -------------------------------------------------------------
      const midHillColor =
        timeOfDay === 'day'
          ? '#a7f3d0'
          : timeOfDay === 'sunset'
          ? '#fdba74'
          : '#bbf7d0';
      ctx.fillStyle = midHillColor;
      ctx.beginPath();
      ctx.moveTo(0, screenH);
      for (let x = 0; x <= screenW; x += 12) {
        const worldPos = x + camX * 0.42;
        const y = getMidgroundY(worldPos) - camY * 0.35;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(screenW, screenH);
      ctx.closePath();
      ctx.fill();

      // Windmills on midground
      for (let w = -1; w < 6; w++) {
        const millWorldX = Math.floor(camX * 0.42 / 450 + w) * 450 + 180;
        const screenMillX = millWorldX - camX * 0.42;
        if (screenMillX >= -50 && screenMillX <= screenW + 50) {
          const millY = getMidgroundY(millWorldX) - camY * 0.35;

          // Tower
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(screenMillX - 4, millY);
          ctx.lineTo(screenMillX + 4, millY);
          ctx.lineTo(screenMillX + 2, millY - 42);
          ctx.lineTo(screenMillX - 2, millY - 42);
          ctx.closePath();
          ctx.fill();

          // Spinning blades
          const bladeAngle = frameCount * 0.03 + millWorldX;
          ctx.save();
          ctx.translate(screenMillX, millY - 42);
          ctx.rotate(bladeAngle);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          for (let b = 0; b < 3; b++) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -22);
            ctx.stroke();
            ctx.rotate((Math.PI * 2) / 3);
          }
          ctx.restore();
        }
      }

      // -------------------------------------------------------------
      // FOREGROUND ROLLING GREEN HILLS (THE ROAD)
      // -------------------------------------------------------------
      const stepSize = 8;
      const roadPts: { x: number; y: number; wx: number }[] = [];
      for (let x = -20; x <= screenW + 30; x += stepSize) {
        const wx = x + camX;
        const gy = getGroundY(wx) - camY;
        roadPts.push({ x, y: gy, wx });
      }

      // Dirt / Soil under grass
      ctx.beginPath();
      ctx.moveTo(-20, screenH);
      for (let pt of roadPts) {
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.lineTo(screenW + 30, screenH);
      ctx.closePath();

      const soilGrad = ctx.createLinearGradient(0, 300 - camY, 0, screenH);
      soilGrad.addColorStop(0, '#3f6212'); // olive earth
      soilGrad.addColorStop(0.15, '#78350f'); // warm earth
      soilGrad.addColorStop(1, '#451a03'); // deep ground
      ctx.fillStyle = soilGrad;
      ctx.fill();

      // Lush Grass Strip (Top border)
      ctx.beginPath();
      for (let i = 0; i < roadPts.length; i++) {
        const pt = roadPts[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = '#15803d'; // deep emerald grass shadow
      ctx.lineWidth = 9;
      ctx.stroke();

      ctx.strokeStyle = '#22c55e'; // bright vibrant grass top
      ctx.lineWidth = 5;
      ctx.stroke();

      // Roadside Trees & Mile Markers
      const startSeg = Math.floor(camX / 140) - 1;
      const endSeg = Math.ceil((camX + screenW) / 140) + 1;
      for (let s = startSeg; s <= endSeg; s++) {
        const treeWx = s * 140 + 40;
        const treeScreenX = treeWx - camX;
        const treeY = getGroundY(treeWx) - camY;
        const rand = pseudoRandom(s);

        if (rand > 0.35) {
          // Draw Tree
          const treeH = 34 + rand * 20;
          ctx.fillStyle = '#78350f'; // trunk
          ctx.fillRect(treeScreenX - 2.5, treeY - 14, 5, 14);

          // Foliage
          ctx.fillStyle = rand > 0.65 ? '#16a34a' : '#15803d';
          ctx.beginPath();
          ctx.arc(treeScreenX, treeY - 14 - treeH * 0.4, treeH * 0.45, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(treeScreenX - 3, treeY - 18 - treeH * 0.4, treeH * 0.32, 0, Math.PI * 2);
          ctx.fill();
        }

        // Mile Marker Flag every 250m
        if (s % 3 === 0) {
          const markerDist = Math.floor(treeWx / 10);
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(treeScreenX + 50, treeY);
          ctx.lineTo(treeScreenX + 50, treeY - 26);
          ctx.stroke();

          // Flag
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(treeScreenX + 50, treeY - 26);
          ctx.lineTo(treeScreenX + 68, treeY - 20);
          ctx.lineTo(treeScreenX + 50, treeY - 14);
          ctx.closePath();
          ctx.fill();

          // Distance sign
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 9px monospace';
          ctx.fillText(`${markerDist}m`, treeScreenX + 42, treeY + 12);
        }
      }

      // -------------------------------------------------------------
      // DRAW PARTICLES (Smoke & Dust)
      // -------------------------------------------------------------
      // Dust
      const dust = dustParticlesRef.current;
      for (let i = dust.length - 1; i >= 0; i--) {
        const p = dust[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        p.radius *= 0.98;

        if (p.alpha <= 0) {
          dust.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(180, 150, 120, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x - camX, p.y - camY, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Smoke Puffs
      const smoke = smokeParticlesRef.current;
      for (let i = smoke.length - 1; i >= 0; i--) {
        const s = smoke[i];
        s.x += s.vx;
        s.y += s.vy;
        s.radius += 0.35;
        s.alpha -= 0.018;

        if (s.alpha <= 0) {
          smoke.splice(i, 1);
          continue;
        }

        ctx.fillStyle = s.color;
        ctx.globalAlpha = Math.max(0, s.alpha);
        ctx.beginPath();
        ctx.arc(s.x - camX, s.y - camY, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // -------------------------------------------------------------
      // DRAW CAR (BEETLE / JEEP CHASSIS & WHEELS)
      // -------------------------------------------------------------
      const carScreenX = car.worldX - camX;
      const carScreenY = car.y - camY;
      const palette = carColorsMap[carColor];

      ctx.save();
      ctx.translate(carScreenX, carScreenY);
      ctx.rotate(car.angle);

      // --- 1. Headlight Light Beam ---
      const beamGrad = ctx.createRadialGradient(28, -6, 2, 95, -6, 60);
      beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
      beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(26, -10);
      ctx.lineTo(105, -28);
      ctx.lineTo(105, 12);
      ctx.lineTo(26, 0);
      ctx.closePath();
      ctx.fill();

      // --- 2. Car Chassis Body ---
      // Lower body
      ctx.fillStyle = palette.body;
      ctx.beginPath();
      ctx.roundRect(-30, -14, 62, 14, [4, 8, 4, 4]);
      ctx.fill();

      // Cabin / Roof (Curved retro canopy)
      ctx.fillStyle = palette.bodyDark;
      ctx.beginPath();
      ctx.moveTo(-16, -14);
      ctx.quadraticCurveTo(-14, -28, 2, -28);
      ctx.lineTo(12, -28);
      ctx.quadraticCurveTo(20, -28, 22, -14);
      ctx.closePath();
      ctx.fill();

      // Cabin Windows (Glass glare)
      ctx.fillStyle = '#bae6fd';
      ctx.beginPath();
      ctx.moveTo(-12, -14);
      ctx.quadraticCurveTo(-10, -25, 0, -25);
      ctx.lineTo(8, -25);
      ctx.lineTo(16, -14);
      ctx.closePath();
      ctx.fill();

      // Driver Silhouette with helmet
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(-2, -18, 5, 0, Math.PI * 2);
      ctx.fill();

      // Window divider
      ctx.strokeStyle = palette.bodyDark;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(1, -25);
      ctx.lineTo(1, -14);
      ctx.stroke();

      // Body Highlight stripe
      ctx.strokeStyle = palette.highlight;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-28, -8);
      ctx.lineTo(28, -8);
      ctx.stroke();

      // Chrome bumpers
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-33, -7, 4, 6);
      ctx.fillRect(30, -7, 4, 6);

      // Headlight lamp & Taillight
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(28, -6, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(-29, -6, 3, 0, Math.PI * 2);
      ctx.fill();

      // Exhaust pipe
      ctx.fillStyle = '#64748b';
      ctx.fillRect(-32, 2, 7, 3);

      // --- 3. Wheels with Rotated Rims ---
      const drawWheel = (wx: number, wy: number) => {
        ctx.save();
        ctx.translate(wx, wy);

        // Suspension strut
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(0, 0);
        ctx.stroke();

        ctx.rotate(car.wheelAngle);

        // Outer rubber tire with tread
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, 0, car.wheelRadius, 0, Math.PI * 2);
        ctx.fill();

        // Alloy Rim
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(0, 0, car.wheelRadius * 0.62, 0, Math.PI * 2);
        ctx.fill();

        // Rim Spokes
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        for (let sp = 0; sp < 4; sp++) {
          ctx.beginPath();
          ctx.moveTo(-car.wheelRadius * 0.55, 0);
          ctx.lineTo(car.wheelRadius * 0.55, 0);
          ctx.stroke();
          ctx.rotate(Math.PI / 4);
        }

        // Center hubcap
        ctx.fillStyle = palette.body;
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      };

      drawWheel(-car.wheelBase / 2, car.wheelRadius);
      drawWheel(car.wheelBase / 2, car.wheelRadius);

      // --- 4. Horn "BEEP BEEP!" pop bubble ---
      if (car.hornPopup > 0) {
        car.hornPopup--;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-24, -50, 68, 20, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('BEEP BEEP! 🎺', -18, -36);
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [carColor, timeOfDay, isGasPressed, isBrakePressed]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 select-none"
      style={{ height: '540px' }}
    >
      {/* Top Glassmorphism Dashboard Status & Controls Bar */}
      <div className="absolute top-3.5 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 p-2 px-3.5 rounded-xl bg-white/95 backdrop-blur-md border border-gray-200/90 shadow-sm text-xs">
        {/* Left: Odometer, Speedometer, and Air Jump Alert */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-gray-800 text-[12px]">
            <Gauge className="w-4 h-4 text-emerald-600" />
            <span>Speed:</span>
            <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              {speedKmH} km/h
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-semibold text-gray-700 text-[11px]">
            <Flag className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-mono text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
              {distanceMeters} m
            </span>
          </div>

          {airTimeText && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[11px] animate-bounce shadow-sm">
              {airTimeText}
            </span>
          )}
        </div>

        {/* Right: Customization Controls (Car Color, Weather, Horn, Reset) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Car Color Picker */}
          <div className="flex items-center gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1">
            <span className="text-[10px] font-bold text-gray-500 px-1">Car:</span>
            {(['emerald', 'red', 'blue', 'amber'] as CarColor[]).map((c) => (
              <button
                key={c}
                onClick={() => setCarColor(c)}
                aria-label={`Select ${c} car`}
                className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                  c === 'emerald'
                    ? 'bg-emerald-600'
                    : c === 'red'
                    ? 'bg-red-600'
                    : c === 'blue'
                    ? 'bg-blue-600'
                    : 'bg-amber-500'
                } ${carColor === c ? 'scale-125 ring-2 ring-gray-900 ring-offset-1' : 'opacity-70 hover:opacity-100'}`}
              />
            ))}
          </div>

          {/* Time of Day */}
          <div className="flex items-center bg-gray-100 border border-gray-200 rounded-lg p-0.5">
            <button
              onClick={() => setTimeOfDay('day')}
              className={`p-1.5 rounded-md transition cursor-pointer ${
                timeOfDay === 'day' ? 'bg-white shadow-xs text-amber-500' : 'text-gray-500'
              }`}
              title="Sunny Day"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTimeOfDay('sunset')}
              className={`p-1.5 rounded-md transition cursor-pointer ${
                timeOfDay === 'sunset' ? 'bg-white shadow-xs text-rose-500' : 'text-gray-500'
              }`}
              title="Sunset"
            >
              <Sunset className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTimeOfDay('morning')}
              className={`p-1.5 rounded-md transition cursor-pointer ${
                timeOfDay === 'morning' ? 'bg-white shadow-xs text-indigo-500' : 'text-gray-500'
              }`}
              title="Morning Dawn"
            >
              <CloudSun className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Horn */}
          <button
            onClick={playHorn}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 text-[11px] font-bold transition cursor-pointer"
            title="Honk Horn (H key)"
          >
            <span>🎺 Honk</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200 transition cursor-pointer"
            title={soundEnabled ? 'Mute sound' : 'Enable audio sound effects'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-600" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Reset position */}
          <button
            onClick={resetCar}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200 transition cursor-pointer"
            title="Reset to Start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main HTML5 Canvas (Hill Driving Animation) */}
      <canvas ref={canvasRef} className="w-full h-full block cursor-pointer" />

      {/* Floating Driving Pedals for Interactive Mouse & Touch Control */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
        {/* Brake Button */}
        <button
          onPointerDown={() => setIsBrakePressed(true)}
          onPointerUp={() => setIsBrakePressed(false)}
          onPointerLeave={() => setIsBrakePressed(false)}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer select-none active:scale-95 ${
            isBrakePressed
              ? 'bg-rose-600 text-white scale-95'
              : 'bg-white/95 text-rose-700 hover:bg-rose-50 border border-rose-200'
          }`}
        >
          <span>🛑 Brake</span>
        </button>

        {/* Jump Button */}
        <button
          onClick={triggerJump}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs bg-white/95 text-indigo-700 hover:bg-indigo-50 border border-indigo-200 shadow-md transition-all cursor-pointer select-none active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Jump</span>
        </button>

        {/* Turbo / Gas Pedal Button */}
        <button
          onPointerDown={() => setIsGasPressed(true)}
          onPointerUp={() => setIsGasPressed(false)}
          onPointerLeave={() => setIsGasPressed(false)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg cursor-pointer select-none active:scale-95 ${
            isGasPressed
              ? 'bg-emerald-600 text-white scale-95 ring-2 ring-emerald-400'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white'
          }`}
        >
          <Zap className="w-4 h-4 fill-current" />
          <span>GAS / BOOST</span>
        </button>
      </div>

      {/* Simple Bottom Left Hints */}
      <div className="absolute bottom-4 left-4 z-20 pointer-events-none hidden sm:flex items-center gap-2 text-[11px] text-gray-600 font-medium">
        <span className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-gray-200/90 shadow-xs">
          🚗 <strong>কন্ট্রোল:</strong> গাড়ি নিজে থেকেই পাহাড়ে স্মুথলি চলবে। স্পিড বাড়াতে <strong>GAS</strong> বাটনে চাপুন বা কী-বোর্ডের <strong>Space / Right Arrow</strong> প্রেস করুন!
        </span>
      </div>
    </div>
  );
}
