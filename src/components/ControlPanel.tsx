import React, { useEffect, useState } from 'react';
import { PltaState } from '../types';
import { Power, Volume2, VolumeX, Sparkles, AlertCircle, CheckCircle2, Wifi, WifiOff, Cpu, Database, Settings, Flame } from 'lucide-react';

interface ControlPanelProps {
  state: PltaState;
  onChangeState: (updater: Partial<PltaState>) => void;
  onWriteModbusRegister?: (register: number, value: number, type: 'gate' | 'debit' | 'temp') => void;
}

export default function ControlPanel({ state, onChangeState, onWriteModbusRegister }: ControlPanelProps) {
  const { isGateOpen, waterDebit, loadRequest, soundEnabled } = state;
  const gateOpening = state.gateOpening !== undefined ? state.gateOpening : (isGateOpen ? 100 : 0);
  const effectiveDebit = waterDebit * (gateOpening / 100);

  // Let's compute simulated output on the fly to show sync status on the control panel
  let efficiency = 0;
  if (effectiveDebit > 0) {
    const fraction = effectiveDebit / 100;
    efficiency = Math.round(94 - 38 * Math.pow(fraction - 0.78, 2));
    efficiency = Math.max(70, Math.min(94, efficiency));
  }
  const head = 120;
  const powerOutputMw = (9.81 * head * effectiveDebit * (efficiency / 100)) / 1000;

  // Sync validation (+/- 4 MW threshold)
  const powerDiff = powerOutputMw - loadRequest;
  const isSynced = gateOpening > 0 && Math.abs(powerDiff) <= 4;
  const isUnderpowered = gateOpening > 0 && powerDiff < -4;
  const isPowerSurge = gateOpening > 0 && powerDiff > 4;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-bold tracking-wider font-display text-slate-200">RUANG KENDALI KONSOL (PLTA OPERATOR COCKPIT)</h3>
        <p className="text-xs text-slate-400 mt-1">Interaksi di bawah ini langsung memengaruhi laju simulasi air, parameter kelistrikan, dan dengung turbin.</p>
      </div>

      {/* PRIMARY TOGGLES SECTION */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Toggle 1: Pintu Air Quick Toggle */}
        <button
          onClick={() => {
            const nextVal = gateOpening > 0 ? 0 : 100;
            if (state.modbusEnabled && onWriteModbusRegister) {
              const reg = state.modbusGateRegister !== undefined ? state.modbusGateRegister : 1;
              onWriteModbusRegister(reg, nextVal, 'gate');
            } else {
              onChangeState({ gateOpening: nextVal, isGateOpen: nextVal > 0 });
            }
          }}
          className={`flex items-center justify-between p-3.5 rounded-xl border font-semibold transition-all duration-300 cursor-pointer ${
            gateOpening > 0
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15'
              : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Power className="h-5 w-5" />
            <div className="text-left font-sans">
              <div className="text-[10px] tracking-wider text-slate-500 font-bold uppercase">Katup Utama (Valve)</div>
              <div className="text-xs">{gateOpening > 0 ? `OPEN ${gateOpening}%` : 'KATUP TERTUTUP'}</div>
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${gateOpening > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {gateOpening > 0 ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Toggle 2: Audio Engine */}
        <button
          onClick={() => onChangeState({ soundEnabled: !soundEnabled })}
          className={`flex items-center justify-between p-3.5 rounded-xl border font-semibold transition-all duration-300 cursor-pointer ${
            soundEnabled
              ? 'bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/15'
              : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            <div className="text-left font-sans">
              <div className="text-[10px] tracking-wider text-slate-500 font-bold uppercase">Sintesis Audio</div>
              <div className="text-xs">{soundEnabled ? 'EFEK SUARA AKTIF' : 'EFEK SUARA SENYAP'}</div>
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${soundEnabled ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-850 text-slate-500'}`}>
            {soundEnabled ? 'SOUND' : 'MUTED'}
          </span>
        </button>
      </div>

      {/* EMERGENCY WORKSPACE EXPULSION CARD WHEN EXPLODED */}
      {state.isExploded && (
        <div className="bg-red-950/40 border border-red-500 hover:border-red-400 text-red-200 rounded-xl p-5 flex flex-col gap-3.5 text-center shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse">
          <div className="mx-auto bg-red-600 p-2.5 rounded-full text-white animate-bounce shadow-[0_0_10px_rgba(220,38,38,0.7)]">
            <Flame className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
              <span>💥 EMERGENCY MELTDOWN 💥</span>
            </h3>
            <p className="text-[11px] text-slate-300 mt-1 lines-relaxed leading-normal">
              Generator PLTA meledak karena suhu generator melewati batas kritis meledak 200°C! Pintu katup otomatis terkunci aman.
            </p>
          </div>
          <button
            onClick={async () => {
              if (state.modbusEnabled && onWriteModbusRegister) {
                const tempReg = state.modbusTempRegister !== undefined ? state.modbusTempRegister : 2;
                const gateReg = state.modbusGateRegister !== undefined ? state.modbusGateRegister : 1;
                const debitReg = state.modbusDebitRegister !== undefined ? state.modbusDebitRegister : 0;
                
                // Write normal temperature first to stop the overload lockout immediately
                await onWriteModbusRegister(tempReg, 45, 'temp');
                // Set reasonable set-points
                await onWriteModbusRegister(gateReg, 100, 'gate');
                await onWriteModbusRegister(debitReg, 45, 'debit');
              } else {
                onChangeState({ 
                  isExploded: false, 
                  generatorTemp: 45, 
                  isGateOpen: true, 
                  gateOpening: 100,
                  waterDebit: 45 
                });
              }
            }}
            className="w-full bg-red-650 hover:bg-red-500 text-white font-bold text-xs uppercase py-2 px-4 rounded-lg shadow-[0_0_12px_rgba(239,68,68,0.6)] cursor-pointer hover:scale-101 active:scale-98 transition transform"
          >
            Perbaiki & Rebuild Generator
          </button>
        </div>
      )}

      {/* MODBUS TCP HARDWARE INTEGRATION COMPONENT */}
      <div className="bg-slate-950/50 rounded-xl p-4.5 border border-slate-850 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-bold tracking-wider text-slate-350 uppercase">Integrasi Modbus TCP</span>
          </div>
          <button
            onClick={() => onChangeState({ modbusEnabled: !state.modbusEnabled })}
            className={`px-3 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full transition cursor-pointer flex items-center gap-1.5 ${
              state.modbusEnabled
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-750'
            }`}
          >
            {state.modbusEnabled ? (
              <>
                <Wifi className="h-3 w-3 animate-pulse" /> Modbus Aktif
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" /> Manual / Simulasi
              </>
            )}
          </button>
        </div>

        {/* MODBUS INPUT CONFIGURATION CARD (Renders IP, Port, and customizable register indices) */}
        <div className="flex flex-col gap-3 bg-slate-900/65 p-3.5 rounded-lg border border-slate-800/80">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Host PLC / IP</label>
              <input
                type="text"
                value={state.modbusIp || '192.168.122.151'}
                onChange={(e) => onChangeState({ modbusIp: e.target.value })}
                placeholder="192.168.122.151"
                disabled={state.modbusEnabled}
                className="w-full bg-slate-950 text-slate-200 border border-slate-850 rounded px-2.5 py-1 text-xs font-mono disabled:opacity-45"
              />
            </div>
            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Server Port</label>
              <input
                type="number"
                value={state.modbusPort || 1502}
                onChange={(e) => onChangeState({ modbusPort: parseInt(e.target.value) || 1502 })}
                placeholder="1502"
                disabled={state.modbusEnabled}
                className="w-full bg-slate-950 text-slate-200 border border-slate-850 rounded px-2.5 py-1 text-xs font-mono disabled:opacity-45"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2 border-t border-slate-850 pt-2.5">
            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Reg Q (Debit)</label>
              <input
                type="number"
                value={state.modbusDebitRegister !== undefined ? state.modbusDebitRegister : 0}
                onChange={(e) => onChangeState({ modbusDebitRegister: parseInt(e.target.value) ?? 0 })}
                placeholder="0"
                disabled={state.modbusEnabled}
                className="w-full bg-slate-950 text-slate-200 border border-slate-850 rounded px-2 py-1 text-xs font-mono disabled:opacity-45 text-center"
              />
            </div>
            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Reg Gate</label>
              <input
                type="number"
                value={state.modbusGateRegister !== undefined ? state.modbusGateRegister : 1}
                onChange={(e) => onChangeState({ modbusGateRegister: parseInt(e.target.value) ?? 1 })}
                placeholder="1"
                disabled={state.modbusEnabled}
                className="w-full bg-slate-950 text-slate-200 border border-slate-850 rounded px-2 py-1 text-xs font-mono disabled:opacity-45 text-center"
              />
            </div>
            <div>
              <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Reg Suhu</label>
              <input
                type="number"
                value={state.modbusTempRegister !== undefined ? state.modbusTempRegister : 2}
                onChange={(e) => onChangeState({ modbusTempRegister: parseInt(e.target.value) ?? 2 })}
                placeholder="2"
                disabled={state.modbusEnabled}
                className="w-full bg-slate-950 text-slate-200 border border-slate-850 rounded px-2 py-1 text-xs font-mono disabled:opacity-45 text-center"
              />
            </div>
          </div>
        </div>

        {/* CONNECTION STATUS SYSTEM STATE METADATA */}
        {state.modbusEnabled && (
          <div className="text-[11px] font-sans">
            {state.modbusStatus === 'connecting' && (
              <div className="flex items-center gap-2 text-amber-400 bg-amber-950/10 border border-amber-900/30 p-2.5 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                <span>Menghubungkan ke Modbus PLC di {state.modbusIp}:{state.modbusPort}...</span>
              </div>
            )}
            
            {state.modbusStatus === 'connected' && (
              <div className="flex items-start gap-2.5 text-emerald-400 bg-emerald-950/15 border border-emerald-900/35 p-2.5 rounded-lg">
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-400 mt-1" />
                <div>
                  <span className="font-semibold block">Koneksi Hardware Sukses! (LIVE)</span>
                  <p className="text-[10px] text-slate-400 mb-1.5 leading-normal">
                    Membaca 3 holding registers dari TCP address:
                  </p>
                  <ul className="list-disc list-inside font-mono text-[10px] text-slate-350 space-y-0.5">
                    <li>Reg {state.modbusDebitRegister} (Q): <strong className="text-sky-400">{waterDebit} m³/s</strong></li>
                    <li>Reg {state.modbusGateRegister} (Gate): <strong className={gateOpening > 0 ? 'text-emerald-400' : 'text-rose-400'}>{gateOpening}% Buka</strong></li>
                    <li>Reg {state.modbusTempRegister} (Suhu): <strong className="text-red-400">{state.generatorTemp}°C</strong></li>
                  </ul>
                </div>
              </div>
            )}

            {state.modbusStatus === 'error' && (
              <div className="flex flex-col gap-1.5 text-rose-400 bg-rose-950/10 border border-rose-900/20 p-2.5 rounded-lg border border-rose-500/30">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <span className="font-semibold block leading-tight">Gagal Menghubungkan ke {state.modbusIp}:{state.modbusPort}</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal ml-6">
                  {state.modbusError || 'Connection refused / offline'}. 
                  Karena aplikasi server PLC Anda di <code className="bg-slate-900/80 px-1 py-0.5 text-rose-400 rounded text-[9px] font-mono">{state.modbusIp}</code> berada di jaringan LAN lokal Anda, 
                  sandboxed cloud platform kami tidak dapat merambah ke IP LAN pribadi Anda.
                  <br /><br />
                  <span className="text-emerald-400 font-semibold leading-relaxed">
                    💡 Rekomendasi: Anda dapat menguji skenario "Suhu generator naik jika RPM tinggi" langsung lewat mode Manual di bawah saat slider debit ditarik penuh ke kanan! Suhu akan naik cepat dan meledak di 200°C.
                  </span>
                  <br />
                  <strong className="text-blue-400 block mt-2.5 cursor-pointer hover:underline" onClick={() => onChangeState({ modbusEnabled: false })}>
                    👉 Sentuh di sini untuk kembali ke mode Manual / Simulasi Slider.
                  </strong>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CORE CONTROLS SYSTEM: SLIDERS */}
      <div className="flex flex-col gap-5">
        {/* SLIDER 1: BUKAAN PINTU AIR (GATE) */}
        <div className="bg-slate-950/50 rounded-xl p-4.5 border border-slate-850">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="gate-opening-slider" className="text-xs font-semibold text-slate-350 tracking-wider flex items-center gap-1.5">
              <span>1. ATUR BUKAAN PINTU AIR (GATE)</span>
              {state.modbusEnabled && (
                <span className="text-[9px] bg-blue-600/35 text-blue-400 border border-blue-800/40 px-1.5 py-0.5 rounded font-mono font-bold animate-pulse">MODBUS LIVE R/W</span>
              )}
            </label>
            <span className="font-mono text-xs text-emerald-400 font-bold">{gateOpening}%</span>
          </div>
          <p className="text-[11px] text-slate-400 mb-4">
            {state.modbusEnabled 
              ? 'Mengontrol & menulis register Pintu Air (Gate) langsung ke PLC Modbus Host secara real-time.'
              : 'Mengatur tingkat tinggi penutup baja penahan air. Membatasi air masuk ke pipa pesat.'}
          </p>
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-mono font-bold text-slate-500">0%</span>
            <input
              id="gate-opening-slider"
              type="range"
              min="0"
              max="100"
              value={gateOpening}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (state.modbusEnabled && onWriteModbusRegister) {
                  const reg = state.modbusGateRegister !== undefined ? state.modbusGateRegister : 1;
                  onWriteModbusRegister(reg, val, 'gate');
                } else {
                  onChangeState({ gateOpening: val, isGateOpen: val > 0 });
                }
              }}
              className="flex-1 accent-emerald-400 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            />
            <span className="text-[11px] font-mono font-bold text-emerald-400">100%</span>
          </div>
        </div>

        {/* SLIDER 2: DEBIT SLIDER */}
        <div className="bg-slate-950/50 rounded-xl p-4.5 border border-slate-850">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="water-debit-slider" className="text-xs font-semibold text-slate-350 tracking-wider flex items-center gap-1.5">
              <span>2. ATUR DEBIT AIR WADUK (Q)</span>
              {state.modbusEnabled && (
                <span className="text-[9px] bg-blue-600/35 text-blue-400 border border-blue-800/40 px-1.5 py-0.5 rounded font-mono font-bold animate-pulse">MODBUS LIVE R/W</span>
              )}
            </label>
            <span className="font-mono text-xs text-sky-400 font-bold">{waterDebit} m³/s</span>
          </div>
          <p className="text-[11px] text-slate-400 mb-4">
            {state.modbusEnabled 
              ? 'Mengontrol & menulis register Debit Air (Q) langsung ke PLC Modbus Host secara real-time.'
              : 'Mengontrol total debit air di reservoir/waduk. Aliran pipa dipicu oleh bukaan pintu air.'}
          </p>
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-mono font-bold text-slate-500">0%</span>
            <input
              id="water-debit-slider"
              type="range"
              min="0"
              max="100"
              value={waterDebit}
              disabled={gateOpening === 0}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (state.modbusEnabled && onWriteModbusRegister) {
                  const reg = state.modbusDebitRegister !== undefined ? state.modbusDebitRegister : 0;
                  onWriteModbusRegister(reg, val, 'debit');
                } else {
                  onChangeState({ waterDebit: val });
                }
              }}
              className="flex-1 accent-sky-400 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            />
            <span className="text-[11px] font-mono font-bold text-sky-400">100%</span>
          </div>
          {gateOpening === 0 && !state.modbusEnabled && (
            <p className="text-[10px] text-amber-500 font-semibold mt-2.5 animate-pulse">
              ⚠️ Pintu Air dalam keadaan tertutup (0%). Naikkan slider "Bukaan Pintu Air" di atas agar air mulai mengalir.
            </p>
          )}
        </div>
      </div>

      {/* CORE CONTROL 3: GRID LOAD INTERACTIVE GAME SYNC */}
      <div className="bg-slate-950/50 rounded-xl p-4.5 border border-slate-850 flex flex-col gap-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-350 tracking-wider">
              3. SINKRONISASI BEBAN GRID KOTA
            </span>
            <span className="font-mono text-xs text-orange-400 font-bold">{loadRequest} MW</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Mensimulasikan beban permintaan daya listrik nasional. Anda harus mengimbangi angka ini dengan menaik-turunkan debit air agar suplai stabil!
          </p>
        </div>

        {/* Load Demand Slider */}
        <div className="flex items-center gap-4">
          <span className="text-[11px] font-mono font-bold text-slate-500">10 MW</span>
          <input
            type="range"
            min="10"
            max="100"
            value={loadRequest}
            onChange={(e) => onChangeState({ loadRequest: parseInt(e.target.value) })}
            className="flex-1 accent-orange-400 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-[11px] font-mono font-bold text-orange-400">100 MW</span>
        </div>

        {/* GRID SYNC FEEDBACK BANNER */}
        <div className="mt-2 text-xs">
          {gateOpening === 0 ? (
            <div className="flex items-start gap-2 p-3 bg-red-950/20 text-red-500 rounded-lg border border-red-950/40">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Grid Listrik Padam (Blackout)!</strong>
                Sistem turbin mati. Harap buka Pintu Air katup utama untuk mulai memproduksi daya listrik.
              </div>
            </div>
          ) : isSynced ? (
            <div className="flex items-start gap-2 p-3 bg-emerald-950/20 text-emerald-400 rounded-lg border border-emerald-950/40">
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Grid Sinkron Sempurna! (Normal 50Hz)</strong>
                Daya PLTA ({powerOutputMw.toFixed(1)} MW) sangat stabil mengimbangi beban kota ({loadRequest} MW). Frekuensi stabil aman.
              </div>
            </div>
          ) : isUnderpowered ? (
            <div className="flex items-start gap-2 p-3 bg-amber-950/20 text-amber-400 rounded-lg border border-amber-950/40 animate-pulse">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Defisit Energi (Frekuensi Turun!)</strong>
                Daya dihasilkan ({powerOutputMw.toFixed(1)} MW) kurang dari permintaan kota ({loadRequest} MW). Geser Debit Air ke kanan!
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 bg-red-950/20 text-red-400 rounded-lg border border-red-950/40 animate-pulse">
              <Sparkles className="h-4.5 w-4.5 shrink-0 mt-0.5 text-red-400" />
              <div>
                <strong className="block font-semibold">Kelebihan Energi (Tegangan Spike!)</strong>
                Daya dihasilkan ({powerOutputMw.toFixed(1)} MW) berlebih dari beban listrik ({loadRequest} MW). Kurangi Debit Air/Bukaan Pintu!
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
