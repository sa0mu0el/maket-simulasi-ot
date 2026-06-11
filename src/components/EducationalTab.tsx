import React from 'react';
import { Hotspot } from '../types';
import { HOTSPOTS } from '../data';
import { ArrowDownRight, BookOpen, Layers, HelpCircle, Landmark } from 'lucide-react';

interface EducationalTabProps {
  activeHotspotId: string | null;
  onSelectHotspot: (id: string | null) => void;
}

export default function EducationalTab({ activeHotspotId, onSelectHotspot }: EducationalTabProps) {
  const activeSpot = HOTSPOTS.find((h) => h.id === activeHotspotId);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-5">
      {/* Title */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800/80">
        <BookOpen className="h-5 w-5 text-sky-400" />
        <h3 className="font-semibold text-sm tracking-wider font-display text-slate-100">KURSUS KILAT ANATOMI PLTA (INTERAKTIF)</h3>
      </div>

      {/* Conditionally reveal details based on clicked activeSpot */}
      {activeSpot ? (
        <div className="bg-slate-950/40 border border-sky-500/25 rounded-xl p-4.5 animate-fadeIn">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-mono tracking-wider font-bold text-sky-400">BAGIAN YANG TERPILIH</span>
            <button
              onClick={() => onSelectHotspot(null)}
              className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-2 py-0.5 rounded transition cursor-pointer"
            >
              Reset Fokus
            </button>
          </div>
          <h4 className="text-base font-bold font-display text-slate-100 flex items-center gap-1.5">
            <Layers className="h-4.5 w-4.5 text-orange-400 shrink-0" />
            {activeSpot.titleIndonesian}
            <span className="text-xs font-normal text-slate-400 italic">({activeSpot.name})</span>
          </h4>
          <p className="mt-3 text-xs text-slate-300 leading-relaxed">
            {activeSpot.description}
          </p>

          <div className="mt-4 pt-3.5 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-400">
            <span>Tahap Konversi Energi:</span>
            <span className="font-mono text-amber-500 font-semibold uppercase tracking-wider">
              {activeSpot.id === 'waduk' && 'Energi Potensial Gravitasi'}
              {activeSpot.id === 'intake' && 'Kontrol Debit Potensial'}
              {activeSpot.id === 'penstock' && 'Energi Potensial → Kinetik AIR'}
              {activeSpot.id === 'turbin' && 'Energi Kinetik → Putaran Mekanik'}
              {activeSpot.id === 'generator' && 'Energi Putaran → Induksi Kelistrikan'}
              {activeSpot.id === 'gardu' && 'Pusat Distribusi Tegangan'}
              {activeSpot.id === 'transformator' && 'Penaik Tegangan Listrik (Step-Up)'}
              {activeSpot.id === 'transmisi' && 'Transmisi Daya Jarak Jauh'}
              {activeSpot.id === 'tailrace' && 'Siklus Alami Limbah Air Bersih'}
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950/20 border border-slate-850 rounded-xl p-4.5 text-center flex flex-col items-center justify-center py-8">
          <Layers className="h-10 w-10 text-slate-500 mb-3 animate-pulse" />
          <h4 className="text-sm font-bold text-slate-300 font-display">Pilih Komponen Maket Simulasi</h4>
          <p className="text-xs text-slate-400 max-w-xs mt-2 leading-relaxed">
            Arahkan kursor Anda atau klik lingkaran berkedip biru/merah pada diagram simulasi PLTA untuk melacak pergerakan listrik dan air.
          </p>
        </div>
      )}

      {/* QUICK FACTS SUMMARY SECTION */}
      <div>
        <h4 className="text-xs font-bold tracking-wider font-display text-slate-400 uppercase mb-3 text-left">Hukum Fisika Utama pada PLTA</h4>
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2.5 bg-slate-950/45 p-3 rounded-xl border border-slate-850 hover:border-slate-800 transition-colors">
            <ArrowDownRight className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-xs font-semibold text-slate-200">Hukum Kekekalan Energi</strong>
              <span className="text-[11px] text-slate-400 leading-normal block mt-1">
                Energi tidak dapat dimusnahkan. Pada PLTA, Energi Potensial Air di Waduk diubah jadi Energi Kinetik di Pipa Pesat, kemudian diubah jadi Energi Mekanik oleh Turbin, hingga akhirnya menjadi Energi Listrik AC oleh Rotor Generator.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-slate-950/45 p-3 rounded-xl border border-slate-850 hover:border-slate-800 transition-colors">
            <ArrowDownRight className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-xs font-semibold text-slate-200">Hukum Faraday (Induksi Magnet)</strong>
              <span className="text-[11px] text-slate-400 leading-normal block mt-1">
                Perubahan fluks magnetik pada kumparan kawat stator yang disebabkan oleh magnet besar rotor yang diputar turbin akan melahirkan beda potensial dan menghasilkan aliran elektron (arus listrik bolak-balik AC).
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-slate-950/45 p-3 rounded-xl border border-slate-850 hover:border-slate-800 transition-colors">
            <ArrowDownRight className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-xs font-semibold text-slate-200">Keunggulan Berkelanjutan (Renewable)</strong>
              <span className="text-[11px] text-slate-400 leading-normal block mt-1">
                PLTA merupakan energi bersih bebas emisi karbon langsung. Air yang keluar dari saluran pembuangan (Tailrace) tetap lestari dalam siklus hidrologi bumi dan tidak tercemar senyawa berbahaya apapun.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
