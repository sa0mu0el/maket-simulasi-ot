import React from 'react';
import { PltaState } from '../types';
import { Zap, Activity, Navigation, Wind, ShieldAlert, Thermometer, Flame } from 'lucide-react';

interface StatsDashboardProps {
  state: PltaState;
}

export default function StatsDashboard({ state }: StatsDashboardProps) {
  const { waterDebit, isGateOpen, generatorTemp, isExploded } = state;
  const gateOpening = state.gateOpening !== undefined ? state.gateOpening : (isGateOpen ? 100 : 0);
  const effectiveDebit = waterDebit * (gateOpening / 100);

  // Real physical formulations:
  // 1. Flow velocity in penstock (Pipa Pesat) in m/s
  // V = Q / A. (Cross-section area A ~ 11.5 m²). Let's simulate a max velocity of 8.5 m/s at 100 m³/s debit.
  const flowVelocity = gateOpening > 0 ? (effectiveDebit / 100) * 8.6 : 0;

  // 2. Turbine Efficiency Curve
  // Turbines are most efficient at 80% load due to fluid dynamics. Let's model this mathematically:
  let efficiency = 0;
  if (effectiveDebit > 0) {
    const fraction = effectiveDebit / 100;
    // Parabolic curve peaking at 0.8: Efficiency = 94 - 40 * (fraction - 0.8)^2
    efficiency = Math.round(94 - 38 * Math.pow(fraction - 0.78, 2));
    efficiency = Math.max(70, Math.min(94, efficiency));
  }

  // 3. Power output (MW)
  // P (kW) = g (9.81 m/s²) * Head (120 meters) * Q (debit) * Efficiency
  // P (MW) = (9.81 * 120 * debit * eff_decimal) / 1000
  const head = 120; // 120-meter drop
  const effDecimal = efficiency / 100;
  const powerOutputKw = effectiveDebit > 0 ? 9.81 * head * effectiveDebit * effDecimal : 0;
  const powerOutputMw = powerOutputKw / 1000;

  // 4. Turbine/Generator RPM (Rotations Per Minute)
  // Generator speed is synchronized with frequency. Real synchronous turbine speed scales up to 375 RPM
  const baseRpm = effectiveDebit > 0 ? (effectiveDebit / 100) * 370 + 5 : 0;
  const turbineRpm = effectiveDebit > 0 ? Math.round(baseRpm * (effDecimal / 0.94)) : 0;

  // 5. Electrical voltage: Generator outputs 13.8 kV, step-up Trafo spikes it to 500 kV
  const genVoltage = effectiveDebit > 0 ? 13.8 + (Math.sin(Date.now() * 0.001) * 0.05) : 0;
  const transmissionVoltage = effectiveDebit > 0 ? 500 + (Math.sin(Date.now() * 0.0015) * 1.8) : 0;

  // 6. Grid Frequency (50.00 Hz in Indonesia)
  // Fluctuates micro-dynamically based on water velocity and turbine governor response
  let frequency = 0;
  if (effectiveDebit > 0) {
    const deviation = (effectiveDebit - 75) * 0.0008; // small load-debit drift
    const vibration = Math.sin(Date.now() * 0.005) * 0.012;
    frequency = 50.00 + deviation + vibration;
  }

  // 7. Green energy offset impact: 1 MWh of Hydro offset equals approx 0.85 kg CO2 compared to coal!
  const co2PreventedPerHourKg = powerOutputMw * 820; // kg CO2 saved per hour

  return (
    <div id="stats-dashboard-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* CARD 1: DAYA LISTRIK */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 relative overflow-hidden flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold tracking-wider font-display text-slate-400">DAYA DIHASILKAN</span>
          <div className={`p-2 rounded-lg ${isGateOpen && waterDebit > 10 ? 'bg-amber-500/15 text-amber-500 animate-pulse' : 'bg-slate-800 text-slate-500'}`}>
            <Zap className="h-5 w-5" />
          </div>
        </div>
        <div>
          <span className="text-3xl font-bold font-mono text-slate-50 tracking-tight">
            {powerOutputMw.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="ml-1.5 text-xs text-amber-400 font-bold tracking-wider">MW</span>
        </div>
        <p className="mt-3 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2.5">
          Cukup untuk melistriki sekitar <strong className="text-slate-200">{Math.round(powerOutputMw * 1100).toLocaleString('id-ID')} rumah</strong> tangga menengah.
        </p>
      </div>

      {/* CARD 2: KECEPATAN ROTASI */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 relative overflow-hidden flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold tracking-wider font-display text-slate-400">ROTASI TURBIN</span>
          <div className="p-2 rounded-lg bg-sky-500/15 text-sky-400">
            <Activity className="h-5 w-5" />
          </div>
        </div>
        <div>
          <span className="text-3xl font-bold font-mono text-slate-50 tracking-tight">
            {turbineRpm}
          </span>
          <span className="ml-1.5 text-xs text-sky-400 font-bold tracking-wider">RPM</span>
        </div>
        <p className="mt-3 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2.5 flex items-center justify-between col-span-2">
          <span>Kecepatan Aliran Air:</span>
          <span className="font-mono text-cyan-400 font-bold">{flowVelocity.toFixed(2)} m/s</span>
        </p>
      </div>

      {/* CARD 3: EFISIENSI SISTEM */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 relative overflow-hidden flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold tracking-wider font-display text-slate-400">EFISIENSI SISTEM</span>
          <div className={`p-2 rounded-lg ${efficiency > 90 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
            <Navigation className="h-5 w-5 rotate-45" />
          </div>
        </div>
        <div>
          <span className="text-3xl font-bold font-mono text-slate-50 tracking-tight">
            {efficiency}
          </span>
          <span className="ml-1.5 text-xs text-emerald-400 font-bold tracking-wider">%</span>
        </div>
        <p className="mt-3 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2.5">
          {efficiency === 0 ? (
            'Katup tertutup. Efisiensi nol.'
          ) : efficiency > 90 ? (
            <span className="text-emerald-400">Optimal! Debit air ideal untuk turbin.</span>
          ) : (
            'Mencari debit air ~ 75-85 m³/s untuk efisiensi puncak.'
          )}
        </p>
      </div>

      {/* CARD 4: VOLTASE TRANSMISI */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 relative overflow-hidden flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold tracking-wider font-display text-slate-400">VOLTASE TRANSMISI SUTET</span>
          <div className="p-2 rounded-lg bg-red-500/15 text-red-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>
        <div>
          <span className="text-3xl font-bold font-mono text-slate-50 tracking-tight">
            {transmissionVoltage > 0 ? Math.round(transmissionVoltage) : 0}
          </span>
          <span className="ml-1.5 text-xs text-red-500 font-bold tracking-wider">kV</span>
        </div>
        <p className="mt-3 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2.5 flex items-center justify-between">
          <span>Keluaran Generator:</span>
          <span className="font-mono text-amber-500 font-bold">{genVoltage ? genVoltage.toFixed(2) : 0} kV</span>
        </p>
      </div>

      {/* CARD 5: FREKUENSI GRID */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 relative overflow-hidden flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold tracking-wider font-display text-slate-400">FREKUENSI KELISTRIKAN</span>
          <div className="p-2 rounded-lg bg-teal-500/15 text-teal-400">
            <Wind className="h-5 w-5" />
          </div>
        </div>
        <div>
          <span className="text-3xl font-bold font-mono text-slate-50 tracking-tight">
            {frequency ? frequency.toFixed(2) : '0.00'}
          </span>
          <span className="ml-1.5 text-xs text-teal-400 font-bold tracking-wider">Hz</span>
        </div>
        <p className="mt-3 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2.5">
          Batas toleransi PLN Indonesia: <strong className="text-slate-200">49.50 Hz - 50.50 Hz</strong>. {frequency > 0 && 'Sistem stabil.'}
        </p>
      </div>

      {/* CARD 6: SUHU GENERATOR & THERMAL HEALTH */}
      <div className={`border rounded-xl p-4.5 relative overflow-hidden flex flex-col justify-between shadow-xs transition-colors duration-300 ${
        isExploded 
          ? 'bg-red-950/20 border-red-500/80 text-red-200 animate-pulse'
          : generatorTemp >= 160
            ? 'bg-amber-950/20 border-amber-500/80 text-amber-200'
            : 'bg-slate-900 border-slate-800 text-slate-100'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold tracking-wider font-display text-slate-400">TEMPERATUR GENERATOR</span>
          <div className={`p-2 rounded-lg ${
            isExploded 
              ? 'bg-red-500/30 text-red-500 animate-bounce' 
              : generatorTemp >= 160 
                ? 'bg-amber-500/30 text-amber-500 animate-pulse' 
                : 'bg-blue-500/15 text-blue-400'
          }`}>
            {isExploded ? <Flame className="h-5 w-5" /> : <Thermometer className="h-5 w-5" />}
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-1">
            <span className={`text-3xl font-bold font-mono tracking-tight ${
              isExploded 
                ? 'text-red-500 animate-pulse' 
                : generatorTemp >= 160 
                  ? 'text-amber-500' 
                  : 'text-slate-50'
            }`}>
              {generatorTemp}
            </span>
            <span className="text-xs text-slate-400 font-bold tracking-wider">°C</span>
          </div>
          
          {/* Linear Progress Bar (0°C to 200°C Max Limit mapped as 100% fill) */}
          <div className="w-full h-1.5 bg-slate-950/60 mt-3.5 rounded-full overflow-hidden border border-slate-850">
            <div 
              style={{ width: `${Math.min(100, (generatorTemp / 200) * 100)}%` }}
              className={`h-full transition-all duration-300 ${
                isExploded 
                  ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.85)]' 
                  : generatorTemp >= 160 
                    ? 'bg-amber-500' 
                    : generatorTemp >= 110 
                      ? 'bg-yellow-400' 
                      : 'bg-emerald-500'
              }`}
            />
          </div>
        </div>
        
        <p className="mt-3 text-[11px] border-t border-slate-800/80 pt-2.5 flex items-center justify-between">
          <span>Thermal Status:</span>
          {isExploded ? (
            <span className="font-bold text-red-500 animate-bounce">🚨 MELEDAK — OVERHEAT!</span>
          ) : generatorTemp >= 160 ? (
            <span className="font-bold text-amber-400 animate-pulse">⚠️ SUHU KRITIS (&gt;160°C)</span>
          ) : generatorTemp >= 110 ? (
            <span className="font-semibold text-yellow-400">Peringatan Overload</span>
          ) : (
            <span className="font-medium text-emerald-400">Normal (Aman)</span>
          )}
        </p>
      </div>
    </div>
  );
}
