import React, { useRef, useEffect, useState } from 'react';
import { PltaState, Hotspot } from '../types';
import { HOTSPOTS } from '../data';

interface PltaCanvasProps {
  state: PltaState;
  onSelectHotspot: (id: string | null) => void;
}

// Logical coordinates for 16:9 canvas layout simulation grid
const LOGICAL_WIDTH = 1000;
const LOGICAL_HEIGHT = 550;

export default function PltaCanvas({ state, onSelectHotspot }: PltaCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 450 });
  const [hoveredHotspot, setHoveredHotspot] = useState<string | null>(null);

  const { isGateOpen } = state;
  const gateOpening = state.gateOpening !== undefined ? state.gateOpening : (isGateOpen ? 100 : 0);

  // Core animation rotation states
  const turbineAngleRef = useRef(0);
  const generatorAngleRef = useRef(0);
  const cloudOffsetRef = useRef(0);
  const waterOffsetRef = useRef(0);

  // Water particles inside the system
  interface Particle {
    id: number;
    section: 'penstock' | 'turbine' | 'tailrace';
    progress: number; // 0.0 to 1.0 within section
    speed: number;
    varianceY: number; // small offset for organic distribution
    varianceX: number;
  }

  const particlesRef = useRef<Particle[]>([]);

  // Electric pulses along SUTET transmission line
  interface ElectricPulse {
    id: number;
    progress: number; // 0 to 1
    type: 'generator-to-trafo' | 'trafo-to-tower2' | 'tower2-to-tower1' | 'tower1-out';
    seed: number;
  }
  const electricityPulsesRef = useRef<ElectricPulse[]>([]);
  const pulseIdCounterRef = useRef(0);

  // Initialize a stable pool of particles
  useEffect(() => {
    const initialParticles: Particle[] = [];
    // Penstock particles
    for (let i = 0; i < 35; i++) {
      initialParticles.push({
        id: i,
        section: 'penstock',
        progress: Math.random(),
        speed: 0.5 + Math.random() * 0.5,
        varianceY: (Math.random() - 0.5) * 16,
        varianceX: (Math.random() - 0.5) * 12,
      });
    }
    // Turbine particles
    for (let i = 35; i < 55; i++) {
      initialParticles.push({
        id: i,
        section: 'turbine',
        progress: Math.random(),
        speed: 0.8 + Math.random() * 0.4,
        varianceY: 0,
        varianceX: 0,
      });
    }
    // Tailrace particles
    for (let i = 55; i < 90; i++) {
      initialParticles.push({
        id: i,
        section: 'tailrace',
        progress: Math.random(),
        speed: 0.4 + Math.random() * 0.4,
        varianceY: (Math.random() - 0.5) * 22,
        varianceX: 0,
      });
    }
    particlesRef.current = initialParticles;
  }, []);

  // Handle ResizeObserver responsive scale
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      // Maintain 16:9 aspect ratio or close to it
      const height = Math.round((width * LOGICAL_HEIGHT) / LOGICAL_WIDTH);
      setDimensions({ width, height });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Main animation frame loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const { waterDebit, isGateOpen } = state;
    const gateOpening = state.gateOpening !== undefined ? state.gateOpening : (isGateOpen ? 100 : 0);
    const effectiveDebit = waterDebit * (gateOpening / 100);
    // Calculate rotation speed proportional to debit & gate opening
    const turbineSpeed = (effectiveDebit / 100) * 0.18;
    const flowVelocity = gateOpening > 0 ? 0.35 + (effectiveDebit / 100) * 1.6 : 0; // Speed scaling

    // Spline path definitions
    // 1. Penstock spline
    const getPenstockPos = (t: number) => {
      // Piecewise linear coordinates matching sloping concrete dam face
      const p0 = { x: 195, y: 215 };
      const p1 = { x: 240, y: 232 };
      const p2 = { x: 330, y: 275 };
      const p3 = { x: 440, y: 340 };
      const p4 = { x: 530, y: 395 };
      const p5 = { x: 605, y: 432 };
      const p6 = { x: 652, y: 435 };

      // Multi-segment interpolation
      const pts = [p0, p1, p2, p3, p4, p5, p6];
      const segments = pts.length - 1;
      const index = Math.min(Math.floor(t * segments), segments - 1);
      const segmentT = (t * segments) - index;

      const curr = pts[index];
      const next = pts[index + 1];

      return {
        x: curr.x + (next.x - curr.x) * segmentT,
        y: curr.y + (next.y - curr.y) * segmentT,
      };
    };

    // 2. Turbine center
    const turbineCenter = { x: 676, y: 454 };

    // 3. Tailrace spline
    const getTailracePos = (t: number) => {
      const p0 = { x: 676, y: 476 }; // Below runner outlet
      const p1 = { x: 676, y: 512 }; // Drop bend
      const p2 = { x: 740, y: 512 }; // Outflow starts
      const p3 = { x: 860, y: 495 }; // Flow exits towards right
      const p4 = { x: 1010, y: 495 }; // Exiting

      const pts = [p0, p1, p2, p3, p4];
      const segments = pts.length - 1;
      const index = Math.min(Math.floor(t * segments), segments - 1);
      const segmentT = (t * segments) - index;

      const curr = pts[index];
      const next = pts[index + 1];

      return {
        x: curr.x + (next.x - curr.x) * segmentT,
        y: curr.y + (next.y - curr.y) * segmentT,
      };
    };

    // Insulators for catenary wiring
    const tower1Insulator = { x: 231, y: 32 };
    const tower2Insulator = { x: 818, y: 133 };
    const trafoInsulator = { x: 810, y: 295 };

    // Render loop
    const render = () => {
      // Clear canvas and scale logical coordinates
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(canvas.width / LOGICAL_WIDTH, canvas.height / LOGICAL_HEIGHT);

      // --- ADVANCE ANIMATION TIMESTAMPS ---
      turbineAngleRef.current += turbineSpeed;
      generatorAngleRef.current += turbineSpeed;
      cloudOffsetRef.current += 0.12;
      waterOffsetRef.current += 0.03 * flowVelocity;

      // Update water particles
      particlesRef.current.forEach((p) => {
        if (p.section === 'penstock') {
          p.progress += 0.006 * flowVelocity * p.speed;
          if (p.progress >= 1.0) {
            p.progress = 0;
            p.section = 'turbine';
          }
        } else if (p.section === 'turbine') {
          p.progress += 0.015 * (flowVelocity || 0.1) * p.speed;
          if (p.progress >= 1.0) {
            p.progress = 0;
            p.section = 'tailrace';
          }
        } else {
          // tailrace
          p.progress += 0.005 * (flowVelocity || 0.25) * p.speed;
          if (p.progress >= 1.0) {
            p.progress = 0;
            p.section = 'penstock'; // loops back to entrance
          }
        }
      });

      // Maintain electricity pulses along wiring
      if (turbineSpeed > 0.01) {
        // Spawn electricity pulses proportionally to actual output
        if (Math.random() < turbineSpeed * 0.4) {
          pulseIdCounterRef.current++;
          electricityPulsesRef.current.push({
            id: pulseIdCounterRef.current,
            progress: 0,
            type: 'generator-to-trafo',
            seed: Math.random(),
          });
        }
      }

      // Update electric pulses speed
      electricityPulsesRef.current.forEach((p) => {
        p.progress += 0.025; // Speed of propagation
      });

      // Chain logic: promote to next segment or clear
      electricityPulsesRef.current = electricityPulsesRef.current.filter((p) => {
        if (p.progress >= 1.0) {
          if (p.type === 'generator-to-trafo') {
            p.type = 'trafo-to-tower2';
            p.progress = 0;
            return true;
          } else if (p.type === 'trafo-to-tower2') {
            p.type = 'tower2-to-tower1';
            p.progress = 0;
            return true;
          } else if (p.type === 'tower2-to-tower1') {
            p.type = 'tower1-out';
            p.progress = 0;
            return true;
          }
          return false; // Exit screen, remove
        }
        return true;
      });

      // ================= DRAW BASE LAYERS =================

      // 1. SKY BACKDROP & GRADIENT
      const skyGrad = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
      skyGrad.addColorStop(0, '#f0f9ff'); // light sky blue
      skyGrad.addColorStop(0.35, '#e0f2fe');
      skyGrad.addColorStop(0.7, '#bae6fd');
      skyGrad.addColorStop(1, '#fed7aa'); // warm orange horizons
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

      // Clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath();
      // Cloud A
      let cloudX = (150 + cloudOffsetRef.current) % (LOGICAL_WIDTH + 200) - 100;
      ctx.arc(cloudX, 60, 25, 0, Math.PI * 2);
      ctx.arc(cloudX + 25, 50, 35, 0, Math.PI * 2);
      ctx.arc(cloudX + 55, 60, 25, 0, Math.PI * 2);
      // Cloud B
      let cloudX2 = (600 + cloudOffsetRef.current * 0.7) % (LOGICAL_WIDTH + 200) - 100;
      ctx.arc(cloudX2, 85, 18, 0, Math.PI * 2);
      ctx.arc(cloudX2 + 18, 75, 24, 0, Math.PI * 2);
      ctx.arc(cloudX2 + 38, 85, 18, 0, Math.PI * 2);
      ctx.fill();

      // Distant mountains
      ctx.fillStyle = '#94a3b8'; // soft slate mountain
      ctx.beginPath();
      ctx.moveTo(-50, 250);
      ctx.lineTo(150, 110);
      ctx.lineTo(380, 250);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#cbd5e1'; // far mountain background
      ctx.beginPath();
      ctx.moveTo(250, 250);
      ctx.lineTo(480, 140);
      ctx.lineTo(750, 250);
      ctx.closePath();
      ctx.fill();

      // Hill terrain behind the dam
      ctx.fillStyle = '#65a30d'; // warm green pasture
      ctx.beginPath();
      ctx.moveTo(-20, 201);
      ctx.quadraticCurveTo(80, 195, 180, 201);
      ctx.lineTo(180, 550);
      ctx.lineTo(-20, 550);
      ctx.closePath();
      ctx.fill();

      // Soil layer bedrock bottom under dam
      const soilGrad = ctx.createLinearGradient(0, 250, 0, LOGICAL_HEIGHT);
      soilGrad.addColorStop(0, '#5c4033'); // muddy brown
      soilGrad.addColorStop(1, '#3b251a');
      ctx.fillStyle = soilGrad;
      ctx.beginPath();
      ctx.moveTo(-10, 201);
      ctx.lineTo(180, 201);
      ctx.lineTo(180, 560);
      ctx.lineTo(-10, 560);
      ctx.closePath();
      ctx.fill();

      // Bedrock right channel
      ctx.beginPath();
      ctx.moveTo(550, 550);
      ctx.quadraticCurveTo(700, 550, 1010, 485); // lower water discharge terrain bed
      ctx.lineTo(1010, 560);
      ctx.lineTo(550, 560);
      ctx.closePath();
      ctx.fill();

      // 2. THE CONCRETE DAM (BENDUNGAN) RETAINING BLOCK
      // Beautiful layered concrete drawing matching original scheme
      ctx.fillStyle = '#94a3b8'; // standard gray concrete
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(180, 130); // dam top
      ctx.lineTo(240, 130); // dam width
      ctx.quadraticCurveTo(240, 170, 248, 205); // top bridge column
      ctx.lineTo(330, 250); // sloping down buttress face
      ctx.lineTo(490, 360);
      ctx.lineTo(610, 400); // bends down block
      ctx.lineTo(615, 560); // base block
      ctx.lineTo(180, 560); // left bottom wall
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Dam gantry crane frame structure on top
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(192, 90, 16, 40); // left column
      ctx.strokeRect(218, 90, 14, 40); // right crane column
      ctx.beginPath();
      ctx.moveTo(188, 90);
      ctx.lineTo(238, 90); // crane beam horizontal
      ctx.stroke();

      // 3. WADUK WATER (RESERVOIR) - Left Screen Area
      // Rich semi-transparent blue water filled to height
      const waterReservoirHeight = 110; // high water level
      const resWaterGrad = ctx.createLinearGradient(0, waterReservoirHeight, 0, 550);
      resWaterGrad.addColorStop(0, 'rgba(14, 165, 233, 0.75)'); // Sky blue transparency
      resWaterGrad.addColorStop(0.3, 'rgba(2, 132, 199, 0.82)');
      resWaterGrad.addColorStop(1, 'rgba(3, 105, 161, 0.93)');

      ctx.fillStyle = resWaterGrad;
      ctx.beginPath();
      ctx.moveTo(0, waterReservoirHeight + Math.sin(waterOffsetRef.current) * 2.5); // water waves
      ctx.quadraticCurveTo(
        90, waterReservoirHeight + Math.cos(waterOffsetRef.current) * 2,
        181, waterReservoirHeight
      );
      ctx.lineTo(181, 230); // block entry
      ctx.lineTo(110, 230);
      ctx.lineTo(110, 550); // reservoir floor
      ctx.lineTo(0, 550);
      ctx.closePath();
      ctx.fill();

      // Wave ripples inside Waduk
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2.5;
      for (let i = 20; i < 180; i += 45) {
        ctx.beginPath();
        ctx.arc(i + (waterOffsetRef.current * 10) % 30, waterReservoirHeight + 4, 12, Math.PI, 0);
        ctx.stroke();
      }

      // 4. POWER HOUSE & UNDERGROUND SUB-STRUCTURE BLOCK
      ctx.fillStyle = '#64748b'; // darker building gray
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;

      // Draw Basement / Tubine Reactor cavern
      ctx.beginPath();
      ctx.moveTo(615, 410); // power house entrance
      ctx.lineTo(884, 410); // tailrace wall partition
      ctx.lineTo(884, 560);
      ctx.lineTo(615, 560);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cavern Cut-out for Turbine reaction chamber and Tailrace
      ctx.fillStyle = '#e2e8f0'; // bright cross-section background inside
      ctx.beginPath();
      ctx.moveTo(614, 435);
      ctx.lineTo(646, 435); // penstock flange entry
      ctx.bezierCurveTo(646, 475, 706, 475, 706, 455); // scroll spiral cavity
      ctx.lineTo(706, 512); // drop tube
      ctx.lineTo(646, 512);
      ctx.bezierCurveTo(646, 550, 715, 550, 725, 550); // cavern loop
      ctx.lineTo(885, 497); // right side discharge portal
      ctx.lineTo(885, 560);
      ctx.lineTo(614, 560);
      ctx.closePath();
      ctx.fill();

      // Tailrace water bed fill inside chamber (semi-transparent blue)
      ctx.fillStyle = 'rgba(2, 132, 199, 0.45)';
      ctx.beginPath();
      ctx.moveTo(650, 480);
      ctx.quadraticCurveTo(710, 480, 710, 455);
      ctx.lineTo(715, 512);
      ctx.quadraticCurveTo(700, 520, 676, 525);
      ctx.lineTo(1010, 525);
      ctx.lineTo(1010, 560);
      ctx.lineTo(614, 560);
      ctx.closePath();
      ctx.fill();

      // Tailrace outlet water to the river (External discharge)
      const outgoingWaterGrad = ctx.createLinearGradient(676, 470, 1010, 550);
      outgoingWaterGrad.addColorStop(0, 'rgba(14, 165, 233, 0.6)');
      outgoingWaterGrad.addColorStop(0.5, 'rgba(2, 132, 199, 0.7)');
      outgoingWaterGrad.addColorStop(1, 'rgba(3, 105, 161, 0.85)');

      ctx.fillStyle = outgoingWaterGrad;
      ctx.beginPath();
      ctx.moveTo(676, 495);
      ctx.bezierCurveTo(
        780, 490 + Math.sin(waterOffsetRef.current + 2) * 5,
        890, 500 + Math.cos(waterOffsetRef.current * 1.5) * 4,
        1010, 480 + Math.sin(waterOffsetRef.current * 2) * 2
      );
      ctx.lineTo(1010, 560);
      ctx.lineTo(615, 560);
      ctx.closePath();
      ctx.fill();

      // Tailrace foam/bubble ripples above outlet representing water coming out of turbine
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      if (turbineSpeed > 0) {
        ctx.beginPath();
        for (let bx = 710; bx < 1000; bx += 38) {
          const waveAmp = 4 * (turbineSpeed * 5);
          ctx.arc(
            bx + (waterOffsetRef.current * 12) % 38,
            495 + Math.sin(waterOffsetRef.current + bx * 0.05) * waveAmp,
            3 + Math.random() * 4,
            0,
            Math.PI,
            true
          );
        }
        ctx.stroke();
      }

      // Above ground Power House (Rumah Pembangkit)
      ctx.fillStyle = '#e2e8f0'; // building facade white/gray
      ctx.strokeStyle = '#475569';
      ctx.beginPath();
      ctx.rect(620, 260, 155, 150);
      ctx.fill();
      ctx.stroke();

      // Power house roof slab
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.rect(612, 250, 171, 10);
      ctx.fill();
      ctx.stroke();

      // Machine foundations
      ctx.fillStyle = '#94a3b8';
      ctx.strokeRect(650, 390, 52, 20);
      ctx.fillRect(650, 390, 52, 20);

      // 5. PIPA PESAT (PENSTOCK) METAL CONDUIT DRAWING
      // Large steel blue pipeline diagonal gradient mapping
      const pipeGrad = ctx.createLinearGradient(190, 200, 650, 435);
      pipeGrad.addColorStop(0, '#1e293b'); // Dark carbon steel colors
      pipeGrad.addColorStop(0.5, '#475569');
      pipeGrad.addColorStop(1, '#0f172a');

      ctx.strokeStyle = pipeGrad;
      ctx.lineWidth = 36;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(195, 215);
      ctx.lineTo(240, 232);
      ctx.lineTo(330, 275);
      ctx.lineTo(440, 340);
      ctx.lineTo(530, 395);
      ctx.lineTo(605, 432);
      ctx.lineTo(650, 435);
      ctx.stroke();

      // Innermost pressurized water stream flowing core inside Pipe
      if (gateOpening > 0) {
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + 0.5 * (gateOpening / 100)})`; // bright glowing cyan water tube
        ctx.lineWidth = 6 + 20 * (gateOpening / 100);
        ctx.beginPath();
        ctx.moveTo(195, 215);
        ctx.lineTo(240, 232);
        ctx.lineTo(330, 275);
        ctx.lineTo(440, 340);
        ctx.lineTo(530, 395);
        ctx.lineTo(605, 432);
        ctx.lineTo(650, 435);
        ctx.stroke();

        // Flow stripes inside penstock
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = Math.max(1, 3 * (gateOpening / 100));
        ctx.setLineDash([15, 25]);
        ctx.lineDashOffset = waterOffsetRef.current * 48; // speed of dashed flowing stream
        ctx.beginPath();
        ctx.moveTo(195, 215);
        ctx.lineTo(240, 232);
        ctx.lineTo(330, 275);
        ctx.lineTo(440, 340);
        ctx.lineTo(530, 395);
        ctx.lineTo(605, 432);
        ctx.lineTo(650, 435);
        ctx.stroke();
        ctx.setLineDash([]); // clear dash
      }

      // Drawing metallic pipe brackets supporting penstock blocks
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(290, 275, 12, 18);
      ctx.fillRect(400, 335, 12, 18);
      ctx.fillRect(500, 395, 12, 18);

      // 6. INTAKE SLIDE GATE DRAWING (PINTU AIR)
      // Animated vertical slide gate position based on gateOpening percentage
      const gateTargetY = 205 - (gateOpening / 100) * 40; // open hides it up (165), closed slides it blocking (205)
      ctx.fillStyle = '#334155'; // steel gate
      ctx.fillRect(177, gateTargetY, 8, 30); // gate plate
      ctx.fillStyle = '#ef4444'; // Red lift bracket
      ctx.fillRect(175, gateTargetY - 10, 12, 6);
      // Lifting steel cables stretching down from gantry crane
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(181, 90);
      ctx.lineTo(181, gateTargetY - 10);
      ctx.stroke();

      // ================= DRAW ACTIVE WATER PARTICLES =================
      if (gateOpening > 0 && waterDebit > 0) {
        ctx.fillStyle = '#f0f9ff'; // Bright white splash water bubbles
        particlesRef.current.forEach((p) => {
          let px = 0, py = 0;

          if (p.section === 'penstock') {
            const pos = getPenstockPos(p.progress);
            // perpendicular vector offsetting for scattered line width
            const rawPosNext = getPenstockPos(Math.min(p.progress + 0.05, 1));
            const dx = rawPosNext.x - pos.x;
            const dy = rawPosNext.y - pos.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = len > 0 ? -dy / len : 0;
            const ny = len > 0 ? dx / len : 0;

            px = pos.x + nx * p.varianceY;
            py = pos.y + ny * p.varianceY;

            ctx.beginPath();
            ctx.arc(px, py, 2.5 + Math.abs(p.varianceX) * 0.1, 0, Math.PI * 2);
            ctx.fill();
          } else if (p.section === 'turbine') {
            // Spiral rotation vortex inside Francis reaction turbine casing
            const radius = 22 - p.progress * 14;
            const currentAngle = p.progress * Math.PI * 4.5 + p.id;
            px = turbineCenter.x + Math.cos(currentAngle) * radius;
            py = turbineCenter.y + Math.sin(currentAngle) * radius;

            ctx.beginPath();
            ctx.arc(px, py, 1.8, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // tailrace
            const tpos = getTailracePos(p.progress);
            px = tpos.x + (p.progress < 0.25 ? 0 : (Math.sin(p.progress * 50 + p.id) * 10));
            py = tpos.y + p.varianceY;

            ctx.beginPath();
            ctx.arc(px, py, 2.2 + p.progress * 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      // ================= DRAW TURBINE & GE_SHAFT =================

      // Steel vertical rotating shaft
      ctx.fillStyle = '#94a3b8';
      const shaftWidth = 8;
      ctx.fillRect(turbineCenter.x - shaftWidth / 2, 360, shaftWidth, 90);
      // Rotating vertical stripes to display shaft rotation!
      if (turbineSpeed > 0) {
        ctx.fillStyle = '#475569';
        const stripeOffset = (turbineAngleRef.current * 15) % 30;
        for (let sh = 365; sh < 445; sh += 20) {
          ctx.fillRect(
            turbineCenter.x - shaftWidth / 2,
            sh + stripeOffset,
            shaftWidth,
            4
          );
        }
      }

      // REACTION TURBINE SUDU-SUDU (BLADES) - Cross section detail
      ctx.save();
      ctx.translate(turbineCenter.x, turbineCenter.y);
      ctx.rotate(turbineAngleRef.current);

      // Turbine rotor core ring
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 8 reaction curved kinetic blades
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      for (let b = 0; b < 8; b++) {
        ctx.beginPath();
        ctx.rotate(Math.PI / 4);
        ctx.moveTo(8, 0);
        ctx.quadraticCurveTo(18, 8, 22, -2); // curved sudu blade
        ctx.stroke();
      }
      ctx.restore();

      // Outer guide vanes frame rings (static casing)
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(turbineCenter.x, turbineCenter.y, 25, 0, Math.PI * 2);
      ctx.stroke();

      // ================= DRAW ELECTRIC GENERATOR =================

      // Stator framework core
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(turbineCenter.x - 38, 320, 76, 40);
      ctx.fill();
      ctx.stroke();

      // Copper coils of generator stator (Amber orange glowing ribs)
      ctx.fillStyle = '#ea580c'; // rich copper wind
      ctx.fillRect(turbineCenter.x - 34, 323, 10, 34);
      ctx.fillRect(turbineCenter.x + 24, 323, 10, 34);
      // Glow coil on active output
      if (turbineSpeed > 0) {
        ctx.fillStyle = `rgba(251, 146, 60, ${0.4 + Math.sin(Date.now() * 0.05) * 0.3})`;
        ctx.fillRect(turbineCenter.x - 34, 323, 10, 34);
        ctx.fillRect(turbineCenter.x + 24, 323, 10, 34);
      }

      // Magnetized rotor spinning core
      ctx.save();
      ctx.translate(turbineCenter.x, 340);
      ctx.rotate(-generatorAngleRef.current * 1.5); // spin generator rapidly

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-15, -15, 30, 30);

      // Alternating magnets poles details (Blue S, Red N)
      ctx.fillStyle = '#ef4444'; // North (Red)
      ctx.fillRect(-15, -15, 30, 8);
      ctx.fillStyle = '#3b82f6'; // South (Blue)
      ctx.fillRect(-15, 7, 30, 8);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 8px Courier';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', 0, -10);
      ctx.fillText('S', 0, 11);

      ctx.restore();

      // Sparks of electromagnetic induction around spinning generator
      if (turbineSpeed > 0.01) {
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 1.5;
        for (let s = 0; s < 3; s++) {
          if (Math.random() < 0.45) {
            const sparkAngle = Math.random() * Math.PI * 2;
            const rOffset = 38 + Math.random() * 12;
            const sx = turbineCenter.x + Math.cos(sparkAngle) * rOffset;
            const sy = 340 + Math.sin(sparkAngle) * (rOffset - 15);

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + (Math.random() - 0.5) * 8, sy + (Math.random() - 0.5) * 8);
            ctx.lineTo(sx + (Math.random() - 0.5) * 6, sy + (Math.random() - 0.5) * 6);
            ctx.stroke();
          }
        }
      }

      // Animated high-intensity fire explosion & smokestack overlaying the Generator in Meltdown state
      if (state.isExploded) {
        // 1. Rising black-gray smoke puffs
        for (let i = 0; i < 6; i++) {
          const tNow = ((Date.now() / 1200) + (i * 0.16)) % 1.0;
          const smokeX = turbineCenter.x + Math.sin(tNow * 5) * 14 + (i - 3) * 3;
          const smokeY = 335 - (tNow * 85);
          const smokeR = 12 + (tNow * 22);
          ctx.fillStyle = `rgba(38, 38, 38, ${0.8 * (1.0 - tNow)})`;
          ctx.beginPath();
          ctx.arc(smokeX, smokeY, smokeR, 0, Math.PI * 2);
          ctx.fill();
        }

        // 2. Multi-layer fire particle bursts
        ctx.save();
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 12;
        for (let i = 0; i < 12; i++) {
          const cycle = Math.sin(Date.now() * 0.015 + i);
          const size = 10 + Math.abs(cycle) * 12;
          const fx = turbineCenter.x + (Math.sin(i * 3) * 22);
          const fy = 340 + (cycle * 8) - (Math.random() * size * 0.4);
          
          const flameGradient = ctx.createRadialGradient(fx, fy, 2, fx, fy, size);
          flameGradient.addColorStop(0, '#fef08a'); // inner hot core
          flameGradient.addColorStop(0.3, '#f97316'); // hot orange
          flameGradient.addColorStop(1, 'rgba(220, 38, 38, 0)'); // vanishing red outline

          ctx.fillStyle = flameGradient;
          ctx.beginPath();
          ctx.arc(fx, fy, size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // 3. System Alarm Flash box
        if (Math.floor(Date.now() / 250) % 2 === 0) {
          ctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
          ctx.strokeStyle = '#fca5a5';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(turbineCenter.x - 70, 275, 140, 18, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 8px Courier New, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('💥 OVERHEAT EXPLOSION 💥', turbineCenter.x, 284);
        }
      }

      // ================= DRAW TRANSFORMER (TRAFO) =================
      const TrafoPos = { x: 808, y: 310 };
      ctx.fillStyle = '#dc2626'; // bright striking red box transformer from diagram
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(TrafoPos.x - 16, TrafoPos.y - 12, 32, 32);
      ctx.fill();
      ctx.stroke();

      // Transformer cooling fins ribs
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(TrafoPos.x - 14, TrafoPos.y + 20, 6, 4);
      ctx.fillRect(TrafoPos.x - 4, TrafoPos.y + 20, 6, 4);
      ctx.fillRect(TrafoPos.x + 6, TrafoPos.y + 20, 6, 4);
      ctx.fillRect(TrafoPos.x - 16, TrafoPos.y - 18, 4, 6);
      ctx.fillRect(TrafoPos.x + 12, TrafoPos.y - 18, 4, 6);

      // Trafo label or indicator glowing coil rings
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // small coiled induction line representing transformator step up winding
      ctx.moveTo(TrafoPos.x - 10, TrafoPos.y + 4);
      for (let cx = -10; cx <= 10; cx += 4) {
        ctx.arc(TrafoPos.x + cx, TrafoPos.y, 4, 0, Math.PI, true);
      }
      ctx.stroke();

      // ================= DRAW TRANSMISSION TOWERS (SUTET) =================

      // Helper function to draw metallic high voltage tower
      const drawSutetTower = (tx: number, ty: number, tHeight: number) => {
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.8;

        // Base frame triangles
        ctx.beginPath();
        // Left leg
        ctx.moveTo(tx - 24, ty + tHeight);
        ctx.lineTo(tx, ty);
        // Right leg
        ctx.moveTo(tx + 24, ty + tHeight);
        ctx.lineTo(tx, ty);

        // Core central trunk
        ctx.moveTo(tx - 8, ty + tHeight);
        ctx.lineTo(tx - 4, ty + 25);
        ctx.lineTo(tx, ty);
        ctx.moveTo(tx + 8, ty + tHeight);
        ctx.lineTo(tx + 4, ty + 25);
        ctx.lineTo(tx, ty);

        // Cross braces
        for (let h = ty + 15; h < ty + tHeight; h += 24) {
          ctx.moveTo(tx - 18, h);
          ctx.lineTo(tx + 18, h);
          ctx.moveTo(tx - 15, h);
          ctx.lineTo(tx + 15, h + 24);
          ctx.moveTo(tx + 15, h);
          ctx.lineTo(tx - 15, h + 24);
        }

        // Horizontal crossarms carrying high tension electrical wires
        // Top arm
        ctx.moveTo(tx - 22, ty + 12);
        ctx.lineTo(tx + 22, ty + 12);
        // Middle arm
        ctx.moveTo(tx - 28, ty + 28);
        ctx.lineTo(tx + 28, ty + 28);
        // Lower arm
        ctx.moveTo(tx - 26, ty + 46);
        ctx.lineTo(tx + 26, ty + 46);

        // Small bell hanging glass insulators (red/orange pins)
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(tx - 23, ty + 12, 2, 4);
        ctx.fillRect(tx + 21, ty + 12, 2, 4);

        ctx.fillRect(tx - 29, ty + 28, 2, 6);
        ctx.fillRect(tx + 27, ty + 28, 2, 6);

        ctx.fillRect(tx - 27, ty + 46, 2, 6);
        ctx.fillRect(tx + 25, ty + 46, 2, 6);

        ctx.stroke();
      };

      // Draw Tower 1 (High transmission steel tower on head hill peak)
      drawSutetTower(231, 32, 100);

      // Draw Tower 2 (Tower on power house station)
      drawSutetTower(818, 133, 75);

      // ================= DRAW TRANSMISSION WIRES (CATENARY LINES) =================
      ctx.strokeStyle = '#334155'; // electrical graphite overhead steel cables
      ctx.lineWidth = 1.3;

      // Cable 1: Trafo to SUTET tower 2
      ctx.beginPath();
      ctx.moveTo(trafoInsulator.x, trafoInsulator.y);
      ctx.lineTo(tower2Insulator.x, tower2Insulator.y + 40); // connect to lower crossarm
      ctx.stroke();

      // Cable 2: Main catenary wire dangling between Tower 1 & Tower 2
      const drawCatenaryCable = (pA: { x: number; y: number }, pB: { x: number; y: number }) => {
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        // Quad control point dipping down for realism
        const midX = (pA.x + pB.x) / 2;
        const midY = (pA.y + pB.y) / 2 + 35; // sagging wire
        ctx.quadraticCurveTo(midX, midY, pB.x, pB.y);
        ctx.stroke();
      };

      const getCatenaryPos = (pA: { x: number; y: number }, pB: { x: number; y: number }, progress: number) => {
        const midX = (pA.x + pB.x) / 2;
        const midY = (pA.y + pB.y) / 2 + 35;

        // Quadratic bezier equation
        const u = 1 - progress;
        const x = u * u * pA.x + 2 * u * progress * midX + progress * progress * pB.x;
        const y = u * u * pA.y + 2 * u * progress * midY + progress * progress * pB.y;

        return { x, y };
      };

      // Sagging high-voltage spans
      drawCatenaryCable(tower2Insulator, tower1Insulator);

      // Hanging spans going left off-screen
      ctx.beginPath();
      ctx.moveTo(tower1Insulator.x, tower1Insulator.y);
      ctx.quadraticCurveTo(115, tower1Insulator.y + 20, -10, tower1Insulator.y - 10);
      ctx.stroke();

      // ================= DRAW ANIMATED ELECTRIC PULSES =================
      electricityPulsesRef.current.forEach((pulse) => {
        let px = 0, py = 0;

        if (pulse.type === 'generator-to-trafo') {
          // Travel from generator stator to trafo step up
          const gX = turbineCenter.x;
          const gY = 320;
          const tX = trafoInsulator.x;
          const tY = trafoInsulator.y;
          px = gX + (tX - gX) * pulse.progress;
          py = gY + (tY - gY) * pulse.progress;
        } else if (pulse.type === 'trafo-to-tower2') {
          // Travel from step-up trafo to the adjacent mast tower 2
          const startX = trafoInsulator.x;
          const startY = trafoInsulator.y;
          const endX = tower2Insulator.x;
          const endY = tower2Insulator.y + 40;
          px = startX + (endX - startX) * pulse.progress;
          py = startY + (endY - startY) * pulse.progress;
        } else if (pulse.type === 'tower2-to-tower1') {
          // Travel over major span catenary curve
          const p = getCatenaryPos(
            { x: tower2Insulator.x, y: tower2Insulator.y + 40 },
            { x: tower1Insulator.x, y: tower1Insulator.y + 40 },
            pulse.progress
          );
          px = p.x;
          py = p.y;
        } else {
          // tower1-out: goes off-screen left
          const t1Ins = { x: tower1Insulator.x, y: tower1Insulator.y + 40 };
          const outPos = { x: -10, y: tower1Insulator.y - 10 };
          const u = 1 - pulse.progress;
          px = u * u * t1Ins.x + 2 * u * pulse.progress * 115 + pulse.progress * pulse.progress * outPos.x;
          py = u * u * t1Ins.y + 2 * u * pulse.progress * (t1Ins.y + 20) + pulse.progress * pulse.progress * outPos.y;
        }

        // Pulse graphic representing electric spark envelope (radiant yellow)
        const radPulseGrad = ctx.createRadialGradient(px, py, 1, px, py, 7);
        radPulseGrad.addColorStop(0, '#ffffff'); // super-white core
        radPulseGrad.addColorStop(0.3, '#facc15'); // vibrant electric gold
        radPulseGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
        ctx.fillStyle = radPulseGrad;

        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.fill();

        // small electricity sparks on cable
        if (Math.random() < 0.2) {
          ctx.strokeStyle = '#eab308';
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + (Math.random() - 0.5) * 10, py - 6 - Math.random() * 4);
          ctx.stroke();
        }
      });

      // ================= DRAW LABEL ARROWS AND POINTERS =================
      // Subtle schematics pointers to matching diagram labels
      ctx.fillStyle = 'rgba(71, 85, 105, 0.08)';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;

      // Draw subtle label bounding connectors
      const drawLabelLink = (x1: number, y1: number, labelText: string, align: 'right' | 'left' | 'center') => {
        ctx.font = '500 10px Inter';
        ctx.fillStyle = '#475569';
        ctx.textAlign = align;
        ctx.setLineDash([2, 2]);
        // draw minimal guide line
        ctx.setLineDash([]);
      };

      // ================= DRAW INTERACTIVE HOTSPOT INDICATORS =================
      HOTSPOTS.forEach((spot) => {
        const isHovered = hoveredHotspot === spot.id;
        const isSelected = state.activeHotspotId === spot.id;

        // Pulse circle glow effect
        const pulseRatio = (Date.now() % 1500) / 1500;
        const outerRadius = 11 + pulseRatio * 15;

        ctx.save();
        ctx.translate(spot.coordinate.x, spot.coordinate.y);

        // Glowing outer pulse ring
        ctx.fillStyle = isSelected
          ? 'rgba(239, 68, 68, 0.22)' // Red for active selected
          : isHovered
          ? 'rgba(56, 189, 248, 0.35)' // Cyan for hovered
          : 'rgba(56, 189, 248, 0.18)'; // Soft blue for static
        ctx.beginPath();
        ctx.arc(0, 0, outerRadius, 0, Math.PI * 2);
        ctx.fill();

        // Hovered/Selected border thickness
        ctx.strokeStyle = isSelected
          ? '#ef4444' // red
          : isHovered
          ? '#0ea5e9' // sky-blue
          : '#38bdf8'; // soft-sky
        ctx.lineWidth = isSelected ? 3 : isHovered ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.stroke();

        // Core white-cyan bead
        ctx.fillStyle = isSelected ? '#ef4444' : '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
        ctx.fill();

        // Inline text tag next to hotspot bubble (always scannable for easy navigation!)
        const isRightSided = spot.coordinate.x > LOGICAL_WIDTH / 2;
        ctx.font = 'bold 9px Inter';
        ctx.textAlign = isRightSided ? 'right' : 'left';
        ctx.fillStyle = isSelected
          ? '#b91c1c'
          : isHovered
          ? '#0284c7'
          : '#334155';

        // Hover offset
        const inlineOffset = isRightSided ? -18 : 18;
        ctx.fillText(spot.titleIndonesian, inlineOffset, 3);

        ctx.restore();
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [state, hoveredHotspot]);

  // Handle canvas mouse click mapping to select a hotspot
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Get mouse click coordinates relative to client bounds, scaled to 1000x550
    const clickX = ((e.clientX - rect.left) / rect.width) * LOGICAL_WIDTH;
    const clickY = ((e.clientY - rect.top) / rect.height) * LOGICAL_HEIGHT;

    // Check mapping to closest hotspot bounds (25px tolerance radius)
    let clickedId: string | null = null;
    for (let i = 0; i < HOTSPOTS.length; i++) {
      const spot = HOTSPOTS[i];
      const dx = clickX - spot.coordinate.x;
      const dy = clickY - spot.coordinate.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 24) {
        clickedId = spot.id;
        break;
      }
    }

    onSelectHotspot(clickedId);
  };

  // Determine hovered hotspot for tooltip highlight
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * LOGICAL_WIDTH;
    const mouseY = ((e.clientY - rect.top) / rect.height) * LOGICAL_HEIGHT;

    let matchedId: string | null = null;
    for (let i = 0; i < HOTSPOTS.length; i++) {
      const spot = HOTSPOTS[i];
      const dx = mouseX - spot.coordinate.x;
      const dy = mouseY - spot.coordinate.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 24) {
        matchedId = spot.id;
        break;
      }
    }

    if (matchedId !== hoveredHotspot) {
      setHoveredHotspot(matchedId);
    }
  };

  return (
    <div
      ref={containerRef}
      id="plta-simulator-container"
      className="relative w-full rounded-2xl bg-slate-900 overflow-hidden shadow-xl border border-slate-700/80 cursor-default"
      style={{ aspectRatio: '16/9' }}
    >
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={() => setHoveredHotspot(null)}
        className="block touch-none"
      />

      {/* Floating Canvas Badges */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none select-none">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider font-display bg-slate-900/90 text-sky-400 border border-sky-500/30 backdrop-blur-md">
          <span className={`h-2.5 w-2.5 rounded-full ${gateOpening > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          STATUS: {gateOpening > 0 ? `OPEN ${gateOpening}%` : 'PINTU TERTUTUP (OFF)'}
        </span>
        {gateOpening > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-mono bg-slate-900/80 text-orange-400 border border-orange-500/20 backdrop-blur-md">
            Debit: {state.waterDebit} m³/s | Efektif: {Math.round(state.waterDebit * (gateOpening / 100))} m³/s
          </span>
        )}
      </div>

      {/* Quick Interactive Hints bar (bottom left floating) */}
      <div className="absolute bottom-4 left-4 bg-slate-950/80 ring-1 ring-slate-800/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-[11px] text-slate-400 font-sans pointer-events-none select-none max-w-xs">
        💡 <span className="text-slate-200 font-medium">Tips:</span> Klik bagian lingkaran biru berkedip di atas untuk penjelasan ilmiah komponen PLTA.
      </div>
    </div>
  );
}
