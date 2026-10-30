"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  hue: number;
};

/**
 * Canvas signal field — drifting nodes, constellation links, soft pulses.
 * Pure canvas; no WebGL dependency. Respects reduced motion.
 */
export function SignalField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let particles: Particle[] = [];
    let t = 0;
    let mouse = { x: -9999, y: -9999 };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.floor(Math.min(90, (w * h) / 18000));
      particles = Array.from({ length: count }, () => spawn());
    };

    const spawn = (): Particle => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      r: 0.8 + Math.random() * 1.8,
      a: 0.25 + Math.random() * 0.55,
      // cyan · violet · amber (construction heat)
      hue: Math.random() > 0.62 ? 188 : Math.random() > 0.45 ? 262 : 42,
    });

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);

      // Soft radial bloom under cursor path
      const g = ctx.createRadialGradient(
        w * 0.5,
        h * 0.28,
        0,
        w * 0.5,
        h * 0.28,
        Math.max(w, h) * 0.55,
      );
      g.addColorStop(0, "rgba(34, 211, 238, 0.04)");
      g.addColorStop(0.45, "rgba(139, 92, 246, 0.03)");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Links
      const linkDist = Math.min(160, w * 0.12);
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < linkDist) {
            const alpha = (1 - dist / linkDist) * 0.18;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(165, 243, 252, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Particles
      for (const p of particles) {
        if (!reduceMotion) {
          const mdx = mouse.x - p.x;
          const mdy = mouse.y - p.y;
          const md = Math.hypot(mdx, mdy);
          if (md < 180) {
            p.vx += (mdx / md) * 0.012;
            p.vy += (mdy / md) * 0.012;
          }

          p.vx *= 0.99;
          p.vy *= 0.99;
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < -20) p.x = w + 20;
          if (p.x > w + 20) p.x = -20;
          if (p.y < -20) p.y = h + 20;
          if (p.y > h + 20) p.y = -20;
        }

        const pulse = reduceMotion
          ? 1
          : 0.75 + 0.25 * Math.sin(t * 1.4 + p.x * 0.01);
        const radius = p.r * pulse;

        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 6);
        glow.addColorStop(0, `hsla(${p.hue}, 90%, 70%, ${p.a * 0.35})`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, 95%, 75%, ${p.a})`;
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Occasional signal arcs
      if (!reduceMotion) {
        const arcCount = 3;
        for (let i = 0; i < arcCount; i++) {
          const phase = t * 0.35 + i * 2.1;
          const cx = w * (0.2 + 0.3 * i);
          const cy = h * (0.35 + 0.1 * Math.sin(phase));
          const r = 40 + 80 * ((Math.sin(phase) + 1) / 2);
          ctx.beginPath();
          ctx.strokeStyle = `rgba(167, 139, 250, ${0.06 + 0.05 * Math.sin(phase)})`;
          ctx.lineWidth = 1;
          ctx.arc(cx, cy, r, phase, phase + 1.2);
          ctx.stroke();
        }
      }

      if (!reduceMotion) {
        raf = requestAnimationFrame(draw);
      }
    };

    resize();
    draw();

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
