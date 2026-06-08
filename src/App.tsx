import { useState, useEffect } from "react";
import { 
  Wifi, 
  WifiOff, 
  Cpu, 
  Power, 
  SlidersHorizontal, 
  Lightbulb,
  Radio,
  RefreshCw,
  Activity,
  Thermometer,
  Droplets,
  FlameKindling,
  Timer,
  Zap
} from "lucide-react";

import { SystemState, MQTTConfig } from "./types";
import RelayCard from "./components/RelayCard";
import VoiceController from "./components/VoiceController";
import SettingsPanel from "./components/SettingsPanel";
import ConsoleLogs from "./components/ConsoleLogs";

const API_BASE = import.meta.env.VITE_API_URL || "";
const fetchApi = (path: string, options?: RequestInit) => fetch(`${API_BASE}${path}`, options);

export default function App() {
  const [state, setState] = useState<SystemState | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Poll system state from full-stack backend
  const fetchState = async (silent = false) => {
    if (!silent) setErrorStatus(null);
    try {
      const res = await fetchApi("/api/state");
      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status}`);
      }
      const data: SystemState = await res.json();
      setState(data);
    } catch (err: any) {
      console.error("Gagal mematangkan status backend:", err);
      setErrorStatus("Tidak dapat terhubung ke server backend Express.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    
    // Auto-polling 1200ms to maintain instantaneous real-time sync with MyQTTHub subscriptions
    const interval = setInterval(() => {
      fetchState(true);
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  // Toggle individual Lamp relay
  const handleToggleRelay = async (id: number, targetState: boolean) => {
    setIsUpdating(true);
    try {
      const res = await fetchApi("/api/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, state: targetState }),
      });
      if (res.ok) {
        const data = await res.json();
        setState(data.dbState);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Connect manually
  const handleConnectMQTT = async () => {
    setIsUpdating(true);
    try {
      const res = await fetchApi("/api/connect", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setState(data.dbState);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Disconnect manually
  const handleDisconnectMQTT = async () => {
    setIsUpdating(true);
    try {
      const res = await fetchApi("/api/disconnect", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setState(data.dbState);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Save Settings configuration
  const handleSaveConfig = async (payload: { config: MQTTConfig; selectedBroker: string }) => {
    setIsUpdating(true);
    try {
      const res = await fetchApi("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setState(data.dbState);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Switch design styles
  const handleToggleStyle = async (newStyle: "neon" | "minimal") => {
    setIsUpdating(true);
    try {
      const res = await fetchApi("/api/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buttonStyle: newStyle }),
      });
      if (res.ok) {
        const data = await res.json();
        setState(data.dbState);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Send voice commands back to backend
  const handleVoiceCommand = async (transcriptText: string) => {
    try {
      const res = await fetchApi("/api/voice-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptText }),
      });
      if (res.ok) {
        const data = await res.json();
        setState(data.dbState);
        return data;
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Local log appender proxy
  const handleLogLocal = async (level: "info" | "success" | "warning" | "error", message: string) => {
    try {
      await fetchApi("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, message }),
      });
      fetchState(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearLogsVisually = async () => {
    try {
      const res = await fetchApi("/api/clear-logs", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setState(data.dbState);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !state) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center font-mono text-xs text-emerald-400 gap-4">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
        <p className="uppercase tracking-widest text-emerald-450 font-bold animate-pulse">Inisialisasi Dashboard Smart IoT...</p>
      </div>
    );
  }

  // Fallback defaults if payload is loading/unreachable
  const activeState = state || {
    relays: [
      { id: 1, name: "Relay Lampu 1", state: false, pin: "GPIO23" },
      { id: 2, name: "Relay Lampu 2", state: false, pin: "GPIO19" },
      { id: 3, name: "Relay Lampu 3", state: false, pin: "GPIO18" },
      { id: 4, name: "Relay Lampu 4", state: false, pin: "GPIO5" },
      { id: 5, name: "Variasi Lampu 1", state: false, pin: "GPIO21" },
      { id: 6, name: "Variasi Lampu 2", state: false, pin: "GPIO22" },
    ],
    mqttConnected: false,
    mqttConnecting: false,
    selectedBroker: "myqtthub",
    config: {
      server: "node02.myqtthub.com",
      port: 8883,
      clientId: "web_client_001",
      user: "web",
      pass: "123",
    },
    logs: [],
    buttonStyle: "neon" as const,
    temperature: "--",
    humidity: "--"
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-400 filter saturate-[1.05]">
      
      {/* 1. TOP NAVBAR PANEL */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Brand/logo section */}
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/5 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <Cpu className="h-6 w-6 animate-pulse text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white font-sans flex items-center gap-2">
                SMART <span className="text-emerald-400 font-mono tracking-wide">MQTT</span> RELAY
              </h1>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                <Radio className="h-3 w-3 text-emerald-500" />
                <span>Terintegrasi Multi-Broker & Sensor DHT11</span>
              </div>
            </div>
          </div>

          {/* Broker Dropdown & Connectivity status */}
          <div className="flex flex-wrap items-center gap-3.5">
            {/* Connection status badge */}
            <div className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border font-mono text-[11px] transition-all duration-300 ${
              activeState.mqttConnected 
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.05)]" 
                : activeState.mqttConnecting
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
            }`}>
              <span className="relative flex h-2 w-2">
                {activeState.mqttConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  activeState.mqttConnected 
                    ? "bg-emerald-400" 
                    : activeState.mqttConnecting
                      ? "bg-amber-400 animate-pulse"
                      : "bg-red-500"
                }`} />
              </span>
              <span className="font-semibold">
                Web Status: {activeState.mqttConnected 
                  ? `Aktif (${
                      activeState.selectedBroker === "flespi" 
                        ? "Flespi.io" 
                        : activeState.selectedBroker === "ably" 
                          ? "Ably.io" 
                          : activeState.selectedBroker === "myqtthub" 
                            ? "MyQTTHub" 
                            : "Broker Kustom"
                    })` 
                  : activeState.mqttConnecting 
                    ? "Menghubungkan..." 
                    : "Terputus"}
              </span>
            </div>

            {/* Port summary badge */}
            <div className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 font-mono text-[11px] text-slate-400">
              <Zap className="h-3.5 w-3.5 text-amber-450" />
              <span>Port: {activeState.config.port}</span>
            </div>

            {/* Connect / Disconnect trigger */}
            {activeState.mqttConnected ? (
              <button
                id="btn-disconnect-broker"
                onClick={handleDisconnectMQTT}
                className="py-2 px-4 cursor-pointer bg-red-600 hover:bg-red-500 text-white rounded-xl font-mono text-xs font-semibold tracking-wider transition-all duration-300 hover:shadow-[0_0_15px_rgba(220,38,38,0.25)] flex items-center gap-1.5 select-none"
              >
                <WifiOff className="h-3.5 w-3.5" />
                <span>PUTUSKAN</span>
              </button>
            ) : (
              <button
                id="btn-connect-broker"
                onClick={handleConnectMQTT}
                disabled={activeState.mqttConnecting}
                className="py-2 px-4 cursor-pointer bg-emerald-500 text-slate-950 rounded-xl font-mono text-xs font-bold tracking-wider transition-all duration-300 hover:bg-emerald-400 hover:shadow-[0_0_15px_rgba(16,185,129,0.35)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 select-none"
              >
                <Wifi className="h-3.5 w-3.5" />
                <span>HUBUNGKAN WEB</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Backend error notification */}
      {errorStatus && (
        <div className="max-w-7xl mx-auto w-full px-6 pt-6 animate-pulse">
          <div className="p-4 bg-red-950/40 border border-red-900/40 rounded-2xl flex items-center gap-3 text-sm text-red-200">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
            <span><strong>Kesalahan Koneksi Server:</strong> {errorStatus} (Gunakan visualizer offline fallback).</span>
          </div>
        </div>
      )}

      {/* 2. CORE WORKSPACE LAYOUT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-16">
        
        {/* LEFT COLUMN: Controls, switches, and voice assistants (7 Span) */}
        <section className="lg:col-span-7 space-y-6">
          
          {/* DHT11 SENSOR TELEMETRY PANEL — Eye-catching & Comfortable visual bento panel */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            {/* Background luxury decoration lines */}
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />
            <div className="absolute left-1/3 bottom-0 h-40 w-40 rounded-full bg-teal-500/5 blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between border-b border-slate-800/70 pb-4 mb-6">
              <div>
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-2 py-0.5 rounded-md">LIVE READINGS</span>
                <h2 className="text-md font-sans font-bold text-white mt-1.5 flex items-center gap-2">
                  <Activity className="h-4.5 w-4.5 text-emerald-400 animate-pulse" /> Sensor Telemetri DHT11
                </h2>
              </div>
              <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                <Timer className="h-3 w-3 animate-spin duration-3000 text-teal-500" /> Auto-sync 5 Detik
              </div>
            </div>

            {/* Telemetry Metric Cards */}
            <div className="grid grid-cols-2 gap-4">
              
              {/* Temperature Card - Glowing Coral/Amber soft theme */}
              <div className="relative bg-slate-900/50 backdrop-blur-sm border border-slate-800/80 hover:border-amber-500/30 rounded-2xl p-5 transition-all duration-300 group hover:shadow-[0_0_20px_rgba(245,158,11,0.03)] flex flex-col justify-between min-h-[140px]">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl group-hover:scale-105 transition-transform duration-353 border border-amber-500/20">
                    <Thermometer className="h-6 w-6 text-amber-400" />
                  </div>
                  <span className="text-[10px] font-mono font-bold tracking-wider text-amber-500 uppercase bg-amber-950/30 border border-amber-900/30 px-2 py-0.5 rounded-md">TEMPERATURE</span>
                </div>
                
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold tracking-tight text-white font-sans">
                    {activeState.temperature && activeState.temperature !== "--" ? activeState.temperature : "--"}
                  </span>
                  <span className="text-lg font-medium text-amber-400 font-mono">°C</span>
                </div>

                <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <FlameKindling className="h-3.5 w-3.5 text-amber-400/80" />
                  <span>{activeState.temperature && activeState.temperature !== "--" ? "Suhu Terdeteksi Stabil" : "Menunggu data perangkat..."}</span>
                </div>
              </div>

              {/* Humidity Card - Glowing Teal/Blue soft theme */}
              <div className="relative bg-slate-900/50 backdrop-blur-sm border border-slate-800/80 hover:border-teal-500/30 rounded-2xl p-5 transition-all duration-300 group hover:shadow-[0_0_20px_rgba(20,184,166,0.03)] flex flex-col justify-between min-h-[140px]">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-teal-500/10 text-teal-400 rounded-xl group-hover:scale-105 transition-transform duration-353 border border-teal-500/20">
                    <Droplets className="h-6 w-6 text-teal-400 animate-bounce duration-2000" />
                  </div>
                  <span className="text-[10px] font-mono font-bold tracking-wider text-teal-400 uppercase bg-teal-950/30 border border-teal-900/30 px-2 py-0.5 rounded-md">HUMIDITY</span>
                </div>
                
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold tracking-tight text-white font-sans">
                    {activeState.humidity && activeState.humidity !== "--" ? activeState.humidity : "--"}
                  </span>
                  <span className="text-lg font-medium text-teal-400 font-mono">%</span>
                </div>

                <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Activity className="h-3.5 w-3.5 text-teal-400/80" />
                  <span>{activeState.humidity && activeState.humidity !== "--" ? "Kelembaban Ruangan Baik" : "Membaca kelembaban..."}</span>
                </div>
              </div>

            </div>
          </div>
          
          {/* Card: Header of Switches */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 mb-6 gap-3">
              <div>
                <h2 className="text-md font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <SlidersHorizontal className="h-4.5 w-4.5 text-emerald-400" /> Kontrol Relay Lampu & Variasi
                </h2>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">ESP32 Pin mapping, ketuk tombol untuk mengontrol</p>
              </div>
            </div>

            {/* Quick Master Switches */}
            <div className="grid grid-cols-2 gap-3 mb-6 bg-slate-950/70 p-4 rounded-xl border border-slate-850">
              <button
                onClick={() => {
                  activeState.relays.forEach(r => handleToggleRelay(r.id, true));
                }}
                className="py-2.5 px-4 cursor-pointer bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 hover:bg-slate-850 font-mono text-xs uppercase tracking-wider font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Lightbulb className="h-4 w-4 animate-pulse text-emerald-450" />
                <span>Nyalakan Semua</span>
              </button>
              <button
                onClick={() => {
                  activeState.relays.forEach(r => handleToggleRelay(r.id, false));
                }}
                className="py-2.5 px-4 cursor-pointer bg-slate-900 border border-slate-800 hover:border-red-500/40 text-slate-400 hover:text-red-450 hover:bg-slate-850 font-mono text-xs uppercase tracking-wider font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Power className="h-4 w-4 text-red-500/80" />
                <span>Matikan Semua</span>
              </button>
            </div>

            {/* Relay grid mapping */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeState.relays.map((relay) => (
                <RelayCard
                  key={relay.id}
                  relay={relay}
                  onToggle={handleToggleRelay}
                />
              ))}
            </div>
          </div>

          {/* Voice assistant widget */}
          <VoiceController
            onCommandReceived={handleVoiceCommand}
            onLogLocal={handleLogLocal}
          />

        </section>

        {/* RIGHT COLUMN: Console Logs & Parameters configuration Settings (5 Span) */}
        <section className="lg:col-span-5 space-y-6">
          
          {/* Console logs */}
          <ConsoleLogs
            logs={activeState.logs}
            onClearLogs={handleClearLogsVisually}
          />

          {/* Configuration panel */}
          <SettingsPanel
            config={activeState.config}
            selectedBroker={activeState.selectedBroker}
            onSave={handleSaveConfig}
          />

        </section>

      </main>

      {/* Footer system details info */}
      <footer className="mt-auto bg-slate-950 border-t border-slate-900 py-8 text-center text-slate-500 text-[10.5px] font-mono">
        <div className="flex items-center justify-center gap-1.5 mb-1.5">
          <Activity className="h-3 w-3 text-emerald-400 animate-pulse" />
          <span>Multi-Broker Cloud Cloud Node Services Online</span>
        </div>
        <div>Dashboard Kontrol IoT • Didesain dengan kenyamanan visual tinggi untuk mode malam.</div>
      </footer>
    </div>
  );
}
