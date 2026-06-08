import { useState, FormEvent } from "react";
import { Settings, Key, Server, Eye, EyeOff, Radio } from "lucide-react";
import { MQTTConfig } from "../types";

interface SettingsPanelProps {
  config: MQTTConfig;
  selectedBroker: string;
  onSave: (data: { config: MQTTConfig; selectedBroker: string }) => Promise<void>;
}

const BROKER_PRESETS: Record<string, MQTTConfig> = {
  myqtthub: {
    server: "node02.myqtthub.com",
    port: 8883,
    clientId: "web_client_001",
    user: "web",
    pass: "123",
  },
  flespi: {
    server: "mqtt.flespi.io",
    port: 8883,
    clientId: "",
    user: "c6NuJ8uBd7CUeHIaMttGwNBPK3bN3NWhob0eCibSDfkXkhiXCqLU6aOAZnDDwdyT",
    pass: "",
  },
  ably: {
    server: "mqtt.ably.io",
    port: 1883,
    clientId: "",
    user: "qPGssQ.ktmyGg",
    pass: "CdSWY4NrlWn4qAEdmv7mgye8EGQKcTnts26qT_i5pRk",
  },
  custom: {
    server: "localhost",
    port: 1883,
    clientId: "client_custom_01",
    user: "",
    pass: "",
  }
};

export default function SettingsPanel({ config, selectedBroker, onSave }: SettingsPanelProps) {
  const [selBroker, setSelBroker] = useState(selectedBroker);
  const [server, setServer] = useState(config.server);
  const [port, setPort] = useState(config.port);
  const [clientId, setClientId] = useState(config.clientId);
  const [user, setUser] = useState(config.user);
  const [pass, setPass] = useState(config.pass);
  
  const [showPassword, setShowPassword] = useState(false);

  // Auto-detect and populate presets upon selection modification
  const handleBrokerSelect = (brokerKey: string) => {
    setSelBroker(brokerKey);
    const preset = BROKER_PRESETS[brokerKey];
    if (preset) {
      setServer(preset.server);
      setPort(preset.port);
      setClientId(preset.clientId);
      setUser(preset.user);
      setPass(preset.pass);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave({
      config: {
        server,
        port: Number(port),
        clientId,
        user,
        pass,
      },
      selectedBroker: selBroker,
    });
  };

  return (
    <div id="settings-panel-container" className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      
      {/* Title Header */}
      <div className="bg-slate-950 px-6 py-4.5 border-b border-slate-800 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
          <Settings className="h-4.5 w-4.5 text-emerald-400" />
        </div>
        <div>
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
            Kredensial & Konfigurasi Broker
          </h4>
          <p className="text-[10px] text-slate-550 font-mono mt-0.5">Kelola pengaturan gerbang konektivitas MQTT</p>
        </div>
      </div>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Broker Brand Dropdown Option */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-450 mb-1.5 flex items-center gap-1.5">
                <Server className="h-3 w-3 text-emerald-400" /> Pilih Broker MQTT Layanan
              </label>
              <select
                value={selBroker}
                onChange={(e) => handleBrokerSelect(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-emerald-500 text-xs font-mono text-slate-200 p-2.5 rounded-xl focus:outline-none transition-colors cursor-pointer"
              >
                <option value="myqtthub" className="bg-slate-950">MyQTTHub Node Broker</option>
                <option value="flespi" className="bg-slate-950">Flespi.io Cloud Service</option>
                <option value="ably" className="bg-slate-950">Ably.io Broker Service</option>
                <option value="custom" className="bg-slate-950">Broker Kustom Lainnya</option>
              </select>
            </div>

            {/* IP / Server */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                Host Server
              </label>
              <input
                type="text"
                value={server}
                required
                onChange={(e) => setServer(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-xs font-mono text-emerald-400 p-2.5 rounded-xl focus:outline-none transition-colors"
                placeholder="Contoh: mqtt.flespi.io"
              />
            </div>

            {/* Port */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                Port (8883 / 1883)
              </label>
              <input
                type="number"
                value={port}
                required
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-xs font-mono text-emerald-400 p-2.5 rounded-xl focus:outline-none transition-colors"
              />
            </div>

            {/* Client ID */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                MQTT Client ID <span className="text-[9px] text-slate-500 italic lowercase">(opsional)</span>
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-xs font-mono text-emerald-400 p-2.5 rounded-xl focus:outline-none transition-colors"
                placeholder="Dibuat otomatis bila kosong"
              />
            </div>

            {/* MQTT Username / Token */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                MQTT Username / Token
              </label>
              <input
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-xs font-mono text-slate-200 p-2.5 rounded-xl focus:outline-none transition-colors truncate"
                placeholder="Username akun broker"
              />
            </div>

            {/* MQTT Password */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                MQTT Password / Secret
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-xs font-mono text-emerald-400 p-2.5 pr-11 rounded-xl focus:outline-none transition-all text-slate-200"
                  placeholder="Kosongkan jika tidak diperlukan"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer"
                  title={showPassword ? "Sembunyikan" : "Tampilkan"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>



          <div className="pt-4 border-t border-slate-850 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 cursor-pointer bg-emerald-500 text-slate-950 hover:bg-emerald-450 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] font-mono text-xs uppercase tracking-wider font-bold rounded-xl transition-all"
            >
              Simpan & Hubungkan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
