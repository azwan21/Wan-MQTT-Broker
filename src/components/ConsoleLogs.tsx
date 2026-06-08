import { useRef, useEffect } from "react";
import { Terminal, ShieldAlert, Trash2, CircleCheck, Info, AlertTriangle, Cpu, Radio, Sparkles } from "lucide-react";
import { LogEntry } from "../types";
import { motion } from "motion/react";

interface ConsoleLogsProps {
  logs: LogEntry[];
  onClearLogs?: () => Promise<void> | void;
}

export default function ConsoleLogs({ logs, onClearLogs }: ConsoleLogsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when new logs arrive (since newer logs are pushed to the start)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [logs]);

  const getLevelStyles = (level: string) => {
    switch (level) {
      case "success":
        return {
          bg: "bg-emerald-500/15 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.15)]",
          text: "text-emerald-300 font-bold",
          icon: <CircleCheck className="h-3.5 w-3.5 text-emerald-400" />,
          label: "SUCCESS",
        };
      case "warning":
        return {
          bg: "bg-amber-500/15 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.15)]",
          text: "text-amber-300 font-bold",
          icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
          label: "WARNING",
        };
      case "error":
        return {
          bg: "bg-red-500/15 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.15)]",
          text: "text-red-300 font-bold",
          icon: <ShieldAlert className="h-3.5 w-3.5 text-red-400" />,
          label: "CRITICAL",
        };
      default:
        return {
          bg: "bg-blue-500/15 border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.15)]",
          text: "text-blue-300 font-bold",
          icon: <Info className="h-3.5 w-3.5 text-blue-400" />,
          label: "SYSTEM",
        };
    }
  };

  return (
    <div 
      id="console-logs-wrapper" 
      className="bg-slate-950 border-2 border-emerald-500/40 hover:border-emerald-500/60 rounded-3xl overflow-hidden flex flex-col h-[525px] shadow-[0_0_30px_rgba(16,185,129,0.12)] transition-all duration-300 relative group"
    >
      {/* Dynamic ambient sweeping background lights */}
      <div className="absolute -left-16 -top-16 h-36 w-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/15 transition-all duration-500" />
      <div className="absolute right-10 bottom-10 h-44 w-44 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Cyberpunk Top Header bar */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-6 py-4.5 border-b border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border-2 border-emerald-500/45 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse">
            <Terminal className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-mono font-black uppercase tracking-wider text-white">
                Log Aktivitas Sistem
              </h3>
              <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded-md text-[8.5px] font-mono tracking-widest bg-emerald-500 text-slate-950 font-bold">
                PRO ACTIVE
              </span>
            </div>
            <p className="text-[10.5px] text-emerald-400/80 font-mono flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Sistem Pemantauan Gerbang IoT Aktif
            </p>
          </div>
        </div>
        
        {onClearLogs && (
          <motion.button
            id="clear-logs-btn"
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
            onClick={onClearLogs}
            className="w-full sm:w-auto py-2.5 px-4.5 rounded-xl cursor-pointer bg-red-500/10 hover:bg-red-600 border border-red-500/40 hover:border-red-500 text-red-400 hover:text-white transition-all duration-300 font-mono text-[11px] font-bold tracking-wider flex items-center justify-center gap-2 select-none shadow-[0_0_15px_rgba(239,68,68,0.12)] hover:shadow-[0_0_25px_rgba(239,68,68,0.35)]"
          >
            <Trash2 className="h-4 w-4 text-red-400 group-hover:text-white" />
            <span>KOSONGKAN LOG</span>
          </motion.button>
        )}
      </div>

      {/* Main Terminal Display Console Screen */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-6 bg-slate-950/95 font-mono text-xs text-slate-350 space-y-4 scrollbar-thin scrollbar-thumb-emerald-500/30 scrollbar-track-transparent relative"
      >
        {/* Terminal Line overlay decoration */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0)_97%,rgba(16,185,129,0.02)_97%)] bg-[length:100%_24px] pointer-events-none" />

        {logs.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-slate-600 gap-4 py-20 relative z-10">
            {/* Pulsing circular visualizer for empty state */}
            <div className="relative flex items-center justify-center">
              <div className="absolute h-24 w-24 rounded-full border-2 border-emerald-500/10 animate-ping duration-3000" />
              <div className="absolute h-18 w-18 rounded-full border border-emerald-500/20 animate-pulse duration-2000" />
              <div className="h-14 w-14 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center text-emerald-500/40 shadow-inner z-10">
                <Cpu className="h-6 w-6 animate-spin duration-15000" />
              </div>
            </div>
            
            <div className="text-center z-10">
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                <Sparkles className="h-4 w-4 animate-bounce text-emerald-400" /> LOG KONSOL BERSIH
              </p>
              <p className="text-[11px] text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
                Belum ada aktivitas baru. Berikan perintah kontrol atau ucapkan perintah lewat Voice Assist.
              </p>
            </div>
          </div>
        ) : (
          <div className="relative z-10 space-y-3">
            {logs.map((log) => {
              const styles = getLevelStyles(log.level);
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 8, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col md:flex-row md:items-start gap-2.5 md:gap-3.5 p-3.5 bg-slate-900/40 hover:bg-slate-900 border border-slate-900 hover:border-emerald-500/20 rounded-2xl transition-all duration-200"
                >
                  <div className="flex items-center gap-2 md:gap-3.5 shrink-0">
                    {/* Time capsule indicator with glowing tech-font */}
                    <span className="bg-slate-950 border border-slate-800/80 px-2.5 py-1 rounded-lg text-emerald-400 font-bold text-[10px] tracking-wider shadow-inner">
                      {log.timestamp}
                    </span>

                    {/* Highly Visible Neon Colored Severity Badge */}
                    <span className={`px-2.5 py-0.5 border text-[9px] font-black rounded-md tracking-widest flex items-center gap-1 uppercase ${styles.bg} ${styles.text}`}>
                      {styles.icon}
                      {styles.label}
                    </span>
                  </div>

                  {/* Log Content Description text */}
                  <span className="text-slate-200 leading-relaxed font-sans text-[12.5px] break-all pt-0.5">
                    {log.message}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cyber Bottom status line strip */}
      <div className="bg-slate-950 border-t border-emerald-500/20 px-6 py-3 flex items-center justify-between text-[10.5px] text-emerald-400/70 font-mono relative z-10">
        <span className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
          </span>
          <span>TEREGISTRASI: {logs.length} LOGS</span>
        </span>
        <span className="flex items-center gap-1">
          <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
          SYSTEM LIVE SYNC
        </span>
      </div>
    </div>
  );
}

