import React, { useState, useEffect, useRef } from 'react';
import { PltaState } from './types';
import PltaCanvas from './components/PltaCanvas';
import ControlPanel from './components/ControlPanel';
import StatsDashboard from './components/StatsDashboard';
import EducationalTab from './components/EducationalTab';
import QuizSection from './components/QuizSection';
import { PltaAudioEngine } from './utils/audio';
import { Zap, HelpCircle, GraduationCap, Volume2, Settings, BarChart2, Radio, Sliders } from 'lucide-react';

export default function App() {
  // Central State Management for Simulation Cockpit
  const [state, setState] = useState<PltaState>({
    isGateOpen: true, // starts running immediately for dynamic preview
    gateOpening: 100, // 100% open by default
    waterDebit: 75, // m³/s (optimal load)
    turbineEfficiency: 92, // %
    loadRequest: 75, // MW (permintaan listrik kota)
    soundEnabled: false, // muted by default for safety
    activeHotspotId: null, // click context
    activeTab: 'simulation',
    quizScore: 0,
    quizSubmitted: false,
    selectedAnswers: {},
    
    // Default Modbus Hardware registers configs
    modbusEnabled: false,
    modbusIp: '192.168.122.151',
    modbusPort: 1502,
    modbusDebitRegister: 0,
    modbusGateRegister: 1,
    modbusTempRegister: 2,
    modbusStatus: 'disconnected',

    generatorTemp: 45, // starts at 45 degrees Celsius operating temp
    isExploded: false
  });

  // Reference for the Web Audio Synthesis Engine
  const audioEngineRef = useRef<PltaAudioEngine | null>(null);

  // Dynamic simulation time clock (HH:MM:SS:MS) matching the design spec
  const [clockStr, setClockStr] = useState('00:00:00:00');

  useEffect(() => {
    let animId: number;
    const updateTime = () => {
      const now = new Date();
      const ms = Math.floor(now.getMilliseconds() / 10).toString().padStart(2, '0');
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}:${ms}`;
      setClockStr(timeStr);
      animId = requestAnimationFrame(updateTime);
    };
    updateTime();
    return () => cancelAnimationFrame(animId);
  }, []);

  // Initialize and update Audio engine whenever variables shift
  useEffect(() => {
    if (!audioEngineRef.current) {
      audioEngineRef.current = new PltaAudioEngine();
    }

    // Set enabled/disabled state
    audioEngineRef.current.setEnabled(state.soundEnabled);

    // Feed current physics metrics to oscillator modulations
    const effectiveDebit = state.waterDebit * (state.gateOpening / 100);
    audioEngineRef.current.update(effectiveDebit, state.gateOpening > 0);

    // Clean up on unmount
    return () => {
      if (audioEngineRef.current) {
        audioEngineRef.current.stop();
      }
    };
  }, [state.soundEnabled, state.waterDebit, state.isGateOpen, state.gateOpening]);

  // Reference to suppress background Modbus polling updates during manual slider modifications (prevents jumping/flickering)
  const lastWriteTimeRef = useRef<{ gate: number; debit: number; temp: number }>({ gate: 0, debit: 0, temp: 0 });

  // Handy state updater callback
  const handleUpdateState = (updater: Partial<PltaState>) => {
    setState((prev) => ({ ...prev, ...updater }));
  };

  // Bidirectional write function to push slider changes to the remote Modbus holding registers
  const handleWriteModbusRegister = async (register: number, value: number, type: 'gate' | 'debit' | 'temp') => {
    // Record current timestamp to block incoming telemetry for this parameter momentarily
    lastWriteTimeRef.current[type] = Date.now();

    // Warmly update immediate local state for crisp, lag-free responsive UI
    setState((prev) => {
      if (type === 'gate') {
        return {
          ...prev,
          gateOpening: value,
          isGateOpen: value > 0
        };
      } else if (type === 'debit') {
        return {
          ...prev,
          waterDebit: value
        };
      } else {
        return {
          ...prev,
          generatorTemp: value,
          isExploded: value >= 200
        };
      }
    });

    try {
      const ip = state.modbusIp || "192.168.122.151";
      const port = state.modbusPort || 1502;
      
      const response = await fetch('/api/modbus-write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ip,
          port,
          register,
          value
        })
      });
      const data = await response.json();
      if (!data.success) {
        console.warn("Modbus write failed:", data.error);
      }
    } catch (err: any) {
      console.error("Gagal mengirim perintah set-point ke PLC:", err.message);
    }
  };

  // Polling loop for Modbus TCP live integration mapping Q, Gate and Temperature
  useEffect(() => {
    if (!state.modbusEnabled) {
      if (state.modbusStatus !== 'disconnected') {
        setState((prev) => ({ ...prev, modbusStatus: 'disconnected', modbusError: undefined }));
      }
      return;
    }

    let isSubscribed = true;
    let pollInterval: NodeJS.Timeout;

    const fetchModbusData = async () => {
      // Set status to connecting initially if disconnected or error
      setState((prev) => {
        if (prev.modbusStatus !== 'connecting' && prev.modbusStatus !== 'connected') {
          return { ...prev, modbusStatus: 'connecting' };
        }
        return prev;
      });

      try {
        const ip = state.modbusIp || "192.168.122.151";
        const port = state.modbusPort || 1502;
        const debitReg = state.modbusDebitRegister !== undefined ? state.modbusDebitRegister : 0;
        const gateReg = state.modbusGateRegister !== undefined ? state.modbusGateRegister : 1;
        const tempReg = state.modbusTempRegister !== undefined ? state.modbusTempRegister : 2;
        
        const response = await fetch(`/api/modbus-data?ip=${ip}&port=${port}&debitReg=${debitReg}&gateReg=${gateReg}&tempReg=${tempReg}`);
        const data = await response.json();

        if (!isSubscribed) return;

        if (data.success) {
          const debitVal = typeof data.debitValue === 'number' ? data.debitValue : 0;
          const gateVal = typeof data.gateValue === 'number' ? data.gateValue : 0;
          const tempVal = typeof data.tempValue === 'number' ? data.tempValue : 45;

          // Constrain physical limits for the visualization mathematical outputs
          const constrainedDebit = Math.max(0, Math.min(100, debitVal));
          
          // Map Modbus register value (0-100) to Gate Opening
          let mappedOpening = 0;
          if (gateVal === 1) {
            mappedOpening = 100; // standard 1/0 binary active
          } else if (gateVal > 1) {
            mappedOpening = Math.min(100, gateVal); // continuous variable percent 0-100%
          }
          const isGateValueOpen = mappedOpening > 0;
          const isTempExploded = tempVal >= 200;

          // Lockout safety check: check if we generated sliders action recently
          const now = Date.now();
          const skipGate = now - lastWriteTimeRef.current.gate < 2500;
          const skipDebit = now - lastWriteTimeRef.current.debit < 2500;
          const skipTemp = now - lastWriteTimeRef.current.temp < 2500;

          setState((prev) => ({
            ...prev,
            modbusStatus: 'connected',
            waterDebit: skipDebit ? prev.waterDebit : constrainedDebit,
            gateOpening: skipGate ? prev.gateOpening : mappedOpening,
            isGateOpen: skipGate ? prev.isGateOpen : isGateValueOpen,
            generatorTemp: skipTemp ? prev.generatorTemp : tempVal,
            isExploded: skipTemp ? prev.isExploded : isTempExploded,
            modbusError: undefined
          }));
        } else {
          setState((prev) => ({
            ...prev,
            modbusStatus: 'error',
            modbusError: data.error || 'Gagal membaca register Modbus'
          }));
        }
      } catch (err: any) {
        if (!isSubscribed) return;
        setState((prev) => ({
          ...prev,
          modbusStatus: 'error',
          modbusError: err.message || 'Gagal memanggil gerbang API Modbus'
        }));
      }
    };

    // Run first feed immediately
    fetchModbusData();

    // Poll every 1500ms for live telemetry
    pollInterval = setInterval(fetchModbusData, 1500);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
    };
  }, [state.modbusEnabled, state.modbusIp, state.modbusPort, state.modbusDebitRegister, state.modbusGateRegister, state.modbusTempRegister]);

  // Local physical thermodynamic simulation loop when Modbus is disabled
  useEffect(() => {
    if (state.modbusEnabled) return;

    const interval = setInterval(() => {
      setState((prev) => {
        if (prev.isExploded) {
          // Slow thermodynamic cooling on explosion until manually reset
          const cooledTemp = Math.max(35, prev.generatorTemp - 1.5);
          return {
            ...prev,
            generatorTemp: cooledTemp
          };
        }

        let nextTemp = prev.generatorTemp;
        const currentOpening = prev.gateOpening !== undefined ? prev.gateOpening : (prev.isGateOpen ? 100 : 0);
        const effectiveDebit = prev.waterDebit * (currentOpening / 100);

        if (effectiveDebit > 0) {
          // Heat generation model based on water flow / RPM overload:
          if (effectiveDebit > 85) {
            // Rapid rise zone!
            nextTemp += 4;
          } else if (effectiveDebit > 72) {
            // High RPM friction climb
            nextTemp += 1.8;
          } else {
            // Approach target running temperature under normal load
            const normalTarget = 40 + (effectiveDebit * 0.85);
            nextTemp += (normalTarget - nextTemp) * 0.1;
          }
        } else {
          // System cools down to ambient operating temperature (30°C)
          nextTemp += (30 - nextTemp) * 0.05;
        }

        // Clean values rounded to integers
        nextTemp = Math.round(nextTemp);

        const exploded = nextTemp >= 200;
        if (exploded) {
          return {
            ...prev,
            generatorTemp: 200,
            isExploded: true,
            isGateOpen: false, // automatic system safety trip
            gateOpening: 0,
            waterDebit: 0
          };
        }

        return {
          ...prev,
          generatorTemp: nextTemp
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.modbusEnabled, state.gateOpening, state.isGateOpen, state.waterDebit, state.isExploded]);

  // Quick helper to select and scroll to focus components
  const handleSelectHotspot = (id: string | null) => {
    setState((prev) => ({
      ...prev,
      activeHotspotId: id,
      // Auto switch to education view to read the anatomical description when a hotspot is clicked!
      activeTab: id ? 'education' : prev.activeTab
    }));
  };

  // Dynamic parameters for SUTET telemetry in the footer
  let frequency = 0;
  if (state.isGateOpen && state.waterDebit > 0) {
    const deviation = (state.waterDebit - 75) * 0.0008;
    const vibration = Math.sin(Date.now() * 0.005) * 0.012;
    frequency = 50.00 + deviation + vibration;
  }
  const realFreq = frequency > 0 ? frequency.toFixed(2) : '0.00';
  const realVoltage = state.isGateOpen ? Math.round(500 + Math.sin(Date.now() * 0.0015) * 1.8) : 0;

  return (
    <div className="bg-slate-950 text-slate-200 min-h-screen flex flex-col font-sans selection:bg-blue-600/20 selection:text-blue-300">
      
      {/* 1. SEAMLESS TOP BANNER/HEADER */}
      <header className="h-16 border-b border-slate-805 bg-slate-900 flex items-center justify-between px-6 sm:px-8 shrink-0 relative z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shadow-[0_0_8px_rgba(37,99,235,0.4)]">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">
            Sistem Monitoring PLTA <span className="text-slate-500 font-normal">v2.4.0</span>
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:block text-right">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Status Sistem</p>
            <p className={`text-sm font-semibold ${state.isGateOpen ? 'text-emerald-400' : 'text-red-500 animate-pulse'}`}>
              {state.isGateOpen ? 'OPERASIONAL - GRID SYNC' : 'OFFLINE - SYSTEM HALTED'}
            </p>
          </div>
          <div className="hidden md:block w-px h-8 bg-slate-800"></div>
          <div className="text-right flex items-center gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Lokasi</p>
              <p className="text-sm font-semibold">Waduk Gajah Mungkur</p>
            </div>
            <button
              onClick={() => handleUpdateState({ soundEnabled: !state.soundEnabled })}
              title="Efek Suara Sintetis"
              className={`p-1.5 rounded border transition cursor-pointer ${
                state.soundEnabled
                  ? 'bg-blue-900/30 border-blue-800 text-blue-400'
                  : 'bg-slate-850 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              <Volume2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN CORE LAYOUT DASHBOARD */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        
        {/* Layout Grid: Left side animation + Stats, Right side interactive drawers */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT AREA: occupying 7 columns on large desktop screens */}
          <section className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
            
            {/* Interactive PLTA Canvas Component */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-end px-1">
                <div>
                  <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Visualisasi Aliran Pipa Pesat (Penstock)</h2>
                  <p className="text-lg font-medium text-slate-200">Skema Turbin Francis Vertikal</p>
                </div>
                <div className="flex gap-2">
                  <span className="px-2.5 py-1 bg-slate-900 text-[10px] text-slate-400 rounded border border-slate-800 font-semibold tracking-wider">CROSS-SECTION VIEW</span>
                  <span className={`px-2.5 py-1 text-[10px] rounded font-semibold tracking-wider transition-colors ${state.isGateOpen ? 'bg-blue-900/20 text-blue-400 border border-blue-800/60' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>
                    {state.isGateOpen ? 'SENSORS ACTIVE' : 'SENSORS OFFLINE'}
                  </span>
                </div>
              </div>
              <PltaCanvas state={state} onSelectHotspot={handleSelectHotspot} />
            </div>

            {/* Live Metrics Grid Dashboard Panel */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Metrik Real-time Keinduksian</h3>
              <StatsDashboard state={state} />
            </div>

          </section>

          {/* RIGHT AREA (SIDE PANEL): occupying 5 columns on desktop */}
          <aside className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5 bg-slate-900/40 p-1 rounded-2xl border border-slate-900/80">
            
            {/* TAB CONTAINER TRIGGER SELECTIONS */}
            <nav id="operator-toggles" className="grid grid-cols-3 bg-slate-900 p-1.5 rounded-xl border border-slate-800 gap-1" aria-label="Menu navigasi konsol">
              {/* Tab 1: Control Cockpit */}
              <button
                onClick={() => handleUpdateState({ activeTab: 'simulation' })}
                className={`py-2 px-1 rounded-lg text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition cursor-pointer ${
                  state.activeTab === 'simulation'
                    ? 'bg-blue-600 text-white font-bold shadow-[0_0_8px_rgba(37,99,235,0.3)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <Sliders className="h-3.5 w-3.5" />
                Kendali
              </button>

              {/* Tab 2: Anatomics Book */}
              <button
                onClick={() => handleUpdateState({ activeTab: 'education' })}
                className={`py-2 px-1 rounded-lg text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition cursor-pointer ${
                  state.activeTab === 'education'
                    ? 'bg-blue-600 text-white font-bold shadow-[0_0_8px_rgba(37,99,235,0.3)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                Anatomi
              </button>

              {/* Tab 3: Quiz Assessment */}
              <button
                onClick={() => handleUpdateState({ activeTab: 'quiz' })}
                className={`py-2 px-1 rounded-lg text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition cursor-pointer ${
                  state.activeTab === 'quiz'
                    ? 'bg-blue-600 text-white font-bold shadow-[0_0_8px_rgba(37,99,235,0.3)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Evaluasi
              </button>
            </nav>

            {/* TAB CONTENT CONTAINER DRAWER */}
            <div className="transition-all duration-300">
              {state.activeTab === 'simulation' && (
                <ControlPanel 
                  state={state} 
                  onChangeState={handleUpdateState} 
                  onWriteModbusRegister={handleWriteModbusRegister}
                />
              )}
              {state.activeTab === 'education' && (
                <EducationalTab activeHotspotId={state.activeHotspotId} onSelectHotspot={handleSelectHotspot} />
              )}
              {state.activeTab === 'quiz' && (
                <QuizSection state={state} onChangeState={handleUpdateState} />
              )}
            </div>

            {/* Quick emergency indicator */}
            {!state.isGateOpen && (
              <div className="p-3 bg-red-950/20 text-red-500 rounded-xl border border-red-900/30 text-xs text-center font-semibold">
                SISTEM SIAGA: Katup Utama Ditutup Oleh Operator
              </div>
            )}

          </aside>

        </div>

        {/* 3. SCIENTIFIC INTRODUCTION DESCRIPTION BANNER (COLLAPSIBLE / PERMANENT AT BOTTOM) */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 mt-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-2">
            💡 Tinjauan Teoretis Pembangkit Listrik Tenaga Air (PLTA)
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            PLTA adalah salah satu jenis kebanggaan infrastruktur energi terbarukan Indonesia yang memanfaatkan daya gravitasi air jatuh untuk membangkitkan listrik kwh nasional secara masif. Waduk di sebelah kiri menahan air sungai pada tingkat elevasi yang stabil, sehingga menghasilkan <strong>Energi Potensial mekanis</strong> yang sebanding dengan selisih ketinggian (Head). Begitu pintu masuk intake dibuka, air mengalir miring melintasi pipa baja silinder yang dinamakan <strong>Pipa Pesat (Penstock)</strong>, memampatkan dan mengubah potensial gravitasi tersebut menjadi kecepatan kencang linear <strong>(Energi Kinetik)</strong>. Aliran deras tersebut menumbuk sudu turbin francis reaksi berdesain hidrostatis melengkung agar memutar poros koaksial searah generator utama <strong>(Energi Mekanik)</strong>. Putaran magnet masif rotor generator di dalam celah stator tembaga lantas melahirkan fluks elektromagnet AC yang diungkit tegangannya oleh <strong>Transformator Step-up</strong> menuju level interkoneksi 500 kV melewati tiang <strong>SUTET transmisi udara bebas hambatan</strong>.
          </p>
        </section>

      </main>

      {/* 4. FOOTER TELEMETRY DATA STRIP */}
      <footer className="bg-slate-950 border-t border-slate-800 flex flex-wrap items-center px-6 py-3.5 gap-4 md:gap-8 shrink-0 overflow-hidden text-[10px] font-mono text-slate-500">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${state.isGateOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span>TRANSMISI SUTET: {state.isGateOpen ? `${realVoltage}kV OK` : 'OFFLINE'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>FREKUENSI INDUKSI:</span>
          <span className="text-slate-300">{realFreq} Hz</span>
        </div>
        <div className="flex items-center gap-2">
          <span>DEBIT AIR:</span>
          <span className="text-slate-300">{state.isGateOpen ? `${state.waterDebit} m³/s` : '0 m³/s'}</span>
        </div>
        <div className="md:ml-auto text-[10px] font-mono text-slate-600">
          SIMULATION TIME: <span id="clock-display" className="text-slate-400 font-bold">{clockStr}</span>
        </div>
      </footer>

      {/* 5. CREDIT FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-5 text-slate-600 text-center text-[11px]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 Monitoring PLTA Interaktif. Dikembangkan untuk Aplikasi Pembelajaran Fisika Kelistrikan Nusantara.</p>
          <div className="flex gap-4">
            <span className="hover:text-slate-400 transition-colors cursor-pointer">Panduan Praktikum</span>
            <span className="hover:text-slate-400 transition-colors cursor-pointer">Glosarium</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
