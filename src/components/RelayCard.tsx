import { motion } from "motion/react";
import { Lightbulb, LightbulbOff, Power, Info } from "lucide-react";
import { RelayState } from "../types";

interface RelayCardProps {
  key?: number | string;
  relay: RelayState;
  onToggle: (id: number, state: boolean) => Promise<void> | void;
}

export default function RelayCard({ relay, onToggle }: RelayCardProps) {
  return (
    <motion.div
      id={`relay-card-neon-${relay.id}`}
      whileHover={{ scale: 1.02, translateY: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`relative overflow-hidden rounded-2xl border bg-slate-900 duration-300 ${
        relay.state
          ? "border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30"
          : "border-slate-800 hover:border-slate-700 hover:shadow-lg"
      }`}
    >
      {/* Glow accent overlay */}
      {relay.state && (
        <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-emerald-500/10 blur-xl pointer-events-none" />
      )}

      <div className="p-6 flex flex-col justify-between h-full">
        <div className="flex justify-between items-start">
          <div className={`p-3 rounded-xl transition-all duration-300 ${
            relay.state 
              ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30" 
              : "bg-slate-850 text-slate-500 border border-slate-800"
          }`}>
            {relay.state ? <Lightbulb className="h-6 w-6 animate-pulse" /> : <LightbulbOff className="h-6 w-6" />}
          </div>

          <div className={`px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider uppercase ${
            relay.state 
              ? "bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/35" 
              : "bg-slate-800 text-slate-400 border border-slate-700"
          }`}>
            {relay.state ? "AKTIF" : "MATI"}
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-medium text-slate-100 group-hover:text-emerald-400 transition-colors">
            {relay.name}
          </h3>
          
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Info className="h-3 w-3 text-emerald-500/70" />
            <span>Pin: {relay.pin}</span>
          </div>
        </div>

        <div className="mt-6">
          <button
            id={`relay-btn-neon-${relay.id}`}
            onClick={() => onToggle(relay.id, !relay.state)}
            className={`w-full py-3 rounded-xl font-mono text-sm tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 select-none ${
              relay.state
                ? "bg-emerald-500 text-slate-950 font-bold hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                : "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white"
            }`}
          >
            <Power className="h-4 w-4" />
            <span>{relay.state ? "TURN OFF" : "TURN ON"}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
