import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as mqtt from "mqtt";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "*", // Mengizinkan semua origin, ideal untuk menghubungkan Vercel ke Railway
  methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Helper function to map IDs to exact control topics
function getTopicForId(id: number): string {
  if (id <= 4) {
    return `kontrol/relay${id}`;
  } else if (id === 5) {
    return `kontrol/variasi1`;
  } else if (id === 6) {
    return `kontrol/variasi2`;
  }
  return `kontrol/relay${id}`;
}

// Main App State with new refined defaults matching user's Arduino code exactly
const dbState = {
  relays: [
    { id: 1, name: "Relay Lampu 1", state: false, pin: "GPIO23 (Pin 23)" },
    { id: 2, name: "Relay Lampu 2", state: false, pin: "GPIO19 (Pin 19)" },
    { id: 3, name: "Relay Lampu 3", state: false, pin: "GPIO18 (Pin 18)" },
    { id: 4, name: "Relay Lampu 4", state: false, pin: "GPIO5 (Pin 5)" },
    { id: 5, name: "Variasi Lampu 1", state: false, pin: "GPIO21 (Pin 21)" },
    { id: 6, name: "Variasi Lampu 2", state: false, pin: "GPIO22 (Pin 22)" },
  ],
  mqttConnected: false,
  mqttConnecting: false,
  selectedBroker: "myqtthub", // 'myqtthub' or 'flespi' or 'custom'
  config: {
    server: "node02.myqtthub.com",
    port: 1883,
    clientId: "web_client",
    user: "web",
    pass: "123"
  },
  logs: [] as any[],
  buttonStyle: "neon" as "neon",
  temperature: "--",
  humidity: "--"
};

// Log helper
function addLog(level: "info" | "success" | "warning" | "error", message: string) {
  const timestamp = new Date().toLocaleTimeString("id-ID", { hour12: false }) + "." + String(new Date().getMilliseconds()).padStart(3, "0");
  const log = {
    id: String(Date.now()) + Math.random().toString(36).substring(2, 5),
    timestamp,
    level,
    message
  };
  dbState.logs.unshift(log);
  if (dbState.logs.length > 80) {
    dbState.logs.pop();
  }
}

// Global MQTT Client reference
let mqttClient: mqtt.MqttClient | null = null;

// Populate initial trace
addLog("info", "Smart IoT Web Controller disimulasikan & didesain untuk sinkronisasi ESP32 / ESP8266.");
addLog("info", "Menghubungkan ke broker MyQTTHub...");

function connectMQTT() {
  if (mqttClient) {
    try {
      mqttClient.end(true);
    } catch (e) {}
    mqttClient = null;
  }

  dbState.mqttConnecting = true;
  dbState.mqttConnected = false;

  if (!dbState.config.clientId || dbState.config.clientId.trim() === "") {
    addLog("error", "Koneksi digagalkan: Client ID tidak boleh kosong!");
    addLog("info", "MyQTTHub mewajibkan Client ID yang secara spesifik didaftarkan di portal web mereka.");
    dbState.mqttConnecting = false;
    return;
  }
  
  const protocol = dbState.config.port === 8883 ? "mqtts" : "mqtt";
  addLog("info", `Mencoba menautkan ke: ${protocol}://${dbState.config.server}:${dbState.config.port}...`);

  // Optimized settings for aggressive network/broker keepalive and instant recovery
  const options: mqtt.IClientOptions = {
    port: dbState.config.port,
    clientId: dbState.config.clientId,
    username: dbState.config.user || undefined,
    password: dbState.config.pass || undefined,
    rejectUnauthorized: false, // Bypass local trust chains for TLS
    connectTimeout: 12000, // Wait up to 12s before timing out
    reconnectPeriod: 8000, // Reconnect every 8s instead of 3s to avoid rapid rate-limiting by MyQTTHub
    keepalive: 45, // Keepalive 45s is the sweet spot for MyQTTHub stability
    clean: true, // Always request clean session for state freshness
  };

  const brokerUrl = `${protocol}://${dbState.config.server}`;
  addLog("info", `Menggunakan Client ID: "${options.clientId}"`);

  try {
    mqttClient = mqtt.connect(brokerUrl, options);

    mqttClient.on("connect", (connack) => {
      dbState.mqttConnected = true;
      dbState.mqttConnecting = false;
      
      const brokerNames: Record<string, string> = {
        myqtthub: "MyQTTHub",
        flespi: "Flespi.io",
        ably: "Ably.io",
        custom: "Broker Kustom"
      };
      const bName = brokerNames[dbState.selectedBroker] || "MQTT";
      addLog("success", `Koneksi BERHASIL Terbuka ke ${bName}`);
      addLog("success", `Detail Sesi: SessionPresent=${connack.sessionPresent}, StatusReturnCode=${connack.reasonCode || 0}`);

      // Subscribe to active topics on Arduino sketch without printing logs
      mqttClient?.subscribe("sensor/suhu");
      mqttClient?.subscribe("sensor/kelembaban");
      mqttClient?.subscribe("kontrol/+");
    });

    mqttClient.on("reconnect", () => {
      dbState.mqttConnecting = true;
      addLog("info", "Menjalankan auto-reconnect berkala ke broker MQTT (setiap 8 detik)...");
    });

    mqttClient.on("offline", () => {
      if (dbState.mqttConnected) {
        dbState.mqttConnected = false;
        addLog("warning", "Status Jaringan: Web offline (kehilangan kontak) dengan broker.");
      }
    });

    mqttClient.on("error", (err) => {
      dbState.mqttConnected = false;
      dbState.mqttConnecting = false;
      const errMsg = err ? err.message : "Error tidak diketahui";
      addLog("error", `MQTT ERROR: ${errMsg}`);
      
      // Auto-terminate client reconnection loop if there is a clear auth/credential failure
      if (errMsg.includes("Not authorized") || errMsg.includes("Bad username") || errMsg.includes("identifier rejected")) {
        addLog("error", "Kritikal: Otentikasi ditolak oleh broker! Menghentikan auto-reconnect untuk menghindari banned IP.");
        addLog("info", "Silakan periksa kembali Host, Port, Username, Password, dan Client ID di bilah Pengaturan.");
        if (mqttClient) {
          mqttClient.end(true);
          mqttClient = null;
        }
      }
    });

    mqttClient.on("close", () => {
      const wasConnected = dbState.mqttConnected;
      dbState.mqttConnected = false;
      dbState.mqttConnecting = false;
      addLog("warning", wasConnected 
        ? "Koneksi diputus oleh pihak broker secara tiba-tiba."
        : "Saluran koneksi ditutup. Gagal menjangkau broker (Periksa koneksi internet / kredensial)."
      );
      addLog("info", "Saran MyQTTHub: Cek apakah Client ID sudah terdaftar di Web MyQTTHub & pastikan tidak dipakai di ESP32 pada saat bersamaan.");
    });

    mqttClient.on("message", (topic, message) => {
      const msgStr = message.toString().trim();
      
      // 1. Temperature Telemetry
      if (topic === "sensor/suhu") {
        dbState.temperature = msgStr;
        return;
      }

      // 2. Humidity Telemetry
      if (topic === "sensor/kelembaban") {
        dbState.humidity = msgStr;
        return;
      }

      // 3. Control topics synchronization
      if (topic.startsWith("kontrol/")) {
        const sub = topic.split("/")[1]; // relay1, relay2, variasi1, variasi2
        let matchedId = 0;
        
        if (sub.startsWith("relay")) {
          matchedId = parseInt(sub.replace("relay", ""));
        } else if (sub === "variasi1") {
          matchedId = 5;
        } else if (sub === "variasi2") {
          matchedId = 6;
        }

        if (matchedId >= 1 && matchedId <= 6) {
          const stateVal = (msgStr.toUpperCase() === "ON" || msgStr === "1");
          const rel = dbState.relays.find(r => r.id === matchedId);
          if (rel && rel.state !== stateVal) {
            rel.state = stateVal;
            addLog("success", `Sinkronisai status [${rel.name}] diperbarui: ${stateVal ? "ON" : "OFF"}`);
          }
        }
      }
    });

  } catch (err: any) {
    dbState.mqttConnected = false;
    dbState.mqttConnecting = false;
    addLog("error", `Kesalahan inisialisasi MQTT: ${err.message}`);
  }
}

function disconnectMQTT() {
  if (mqttClient) {
    mqttClient.end(true, () => {
      dbState.mqttConnected = false;
      dbState.mqttConnecting = false;
      addLog("info", "Web diputuskan dari broker MQTT oleh pengguna.");
    });
    mqttClient = null;
  } else {
    addLog("warning", "Mencoba memutuskan koneksi, tapi tidak ada koneksi aktif.");
  }
}

// Auto-connect on startup
connectMQTT();

// ==========================================
// REST API ROUTES
// ==========================================

// Get system state
app.get("/api/state", (req, res) => {
  res.json(dbState);
});

// Clear all logs
app.post("/api/clear-logs", (req, res) => {
  dbState.logs = [];
  addLog("success", "Daftar log aktivitas telah dibersihkan secara permanen.");
  res.json({ success: true, dbState });
});

// Update broker configuration
app.post("/api/config", (req, res) => {
  const { config, selectedBroker } = req.body;

  let target_broker = 1; // Default MyQTTHub
  if (selectedBroker === "ably") target_broker = 2;
  else if (selectedBroker === "flespi") target_broker = 3;

  // Jika sedang berpindah broker, publikasikan perintah ke ESP32 sebelum server web terputus
  if (selectedBroker && selectedBroker !== dbState.selectedBroker) {
    if (dbState.mqttConnected && mqttClient) {
      try {
        mqttClient.publish("kontrol/server", String(target_broker), { qos: 1 });
        addLog("success", `[SINKRONISASI] Mengirim instruksi pindah (ID: ${target_broker}) ke module ESP.`);
      } catch (e) {
        addLog("error", "Gagal memancarkan instruksi pindah broker via MQTT.");
      }
    }
  }

  if (config) {
    dbState.config = { ...dbState.config, ...config };
  }
  if (selectedBroker) {
    dbState.selectedBroker = selectedBroker;
  }
  
  addLog("info", `Parameter broker diperbarui ke: ${dbState.config.server}:${dbState.config.port}`);
  
  // Re-connect dengan jeda 1 detik agar payload MQTT dpt terkirim sebelum diputus
  setTimeout(() => {
    connectMQTT();
  }, 1000);

  res.json({ success: true, dbState });
});

// Update style variation
app.post("/api/style", (req, res) => {
  const { buttonStyle } = req.body;
  if (buttonStyle === "neon" || buttonStyle === "minimal") {
    dbState.buttonStyle = buttonStyle;
    addLog("info", `Gaya tombol antarmuka diubah ke mode: ${buttonStyle === "neon" ? "Aksen Neon" : "Minimalis Premium"}`);
    res.json({ success: true, dbState });
  } else {
    res.status(400).json({ error: "Gaya tombol tidak dikenal" });
  }
});

// Connect manual
app.post("/api/connect", (req, res) => {
  connectMQTT();
  res.json({ success: true, dbState });
});

// Disconnect manual
app.post("/api/disconnect", (req, res) => {
  disconnectMQTT();
  res.json({ success: true, dbState });
});

// Toggle/Set relay state
app.post("/api/relay", (req, res) => {
  const { id, state } = req.body;
  const relayId = parseInt(id);
  const relayState = !!state;

  const relay = dbState.relays.find(r => r.id === relayId);
  if (!relay) {
    return res.status(404).json({ error: "Relay tidak ditemukan." });
  }

  // Update State
  relay.state = relayState;
  addLog("info", `Tombol ditekan: mengubah ${relay.name} menjadi ${relayState ? "ON" : "OFF"}`);

  // Publish to exact control topic based on Arduino sketch requirements
  if (dbState.mqttConnected && mqttClient) {
    const topic = getTopicForId(relayId);
    const payload = relayState ? "ON" : "OFF"; // Sketch expects "ON" or "OFF" (case sensitive payload)

    try {
      mqttClient.publish(topic, payload, { qos: 1, retain: true });
      addLog("success", `[MQTT Publish] Mengirim ke topik '${topic}' dengan payload: "${payload}"`);
    } catch (err: any) {
      addLog("error", `Gagal mempublikasikan perintah MQTT: ${err.message}`);
    }
  } else {
    addLog("warning", `MQTT Terputus: Perintah lokal ${relay.name} diubah menjadi ${relayState ? "ON" : "OFF"}`);
  }

  res.json({ success: true, dbState });
});

// Add log entry from client side
app.post("/api/log", (req, res) => {
  const { level, message } = req.body;
  if (level && message) {
    addLog(level, message);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: "Parameter level dan message wajib diisi." });
  }
});

// Handle Voice commands on backend
app.post("/api/voice-command", (req, res) => {
  const { transcript } = req.body;
  if (!transcript) {
    return res.status(400).json({ error: "Kueri suara kosong" });
  }

  const text = transcript.toLowerCase();
  addLog("info", `Mendengar suara: "${transcript}"`);

  let matched = false;
  let actionMessage = "";

  // Helper matching
  const findMatch = (terms: string[]) => terms.some(term => text.includes(term));

  // Check which relay or custom combo
  if (findMatch(["suhu", "kelembaban", "cuaca", "panas"])) {
    actionMessage = `Suhu ruangan saat ini adalah ${dbState.temperature || "belum tersedia"} derajat celcius, dan kelembaban ${dbState.humidity || "belum tersedia"} persen.`;
    matched = true;
    addLog("info", `Voice Command: Menanyakan info suhu.`);
  } else if (findMatch(["semua hidup", "hidupkan semua", "nyalakan semua", "semua aktif", "all on", "semua on"])) {
    dbState.relays.filter(r => r.id <= 4).forEach(r => { r.state = true; });
    actionMessage = "Menyalakan semua lampu.";
    matched = true;
    
    // Publish all
    if (dbState.mqttConnected && mqttClient) {
      dbState.relays.filter(r => r.id <= 4).forEach(r => {
        mqttClient?.publish(getTopicForId(r.id), "ON", { qos: 1, retain: true });
      });
      addLog("success", `[MQTT Publish] Mempublikasikan semua lampu: ON`);
    }
  } else if (findMatch(["semua mati", "matikan semua", "semua nonaktif", "all off", "semua off"])) {
    dbState.relays.filter(r => r.id <= 4).forEach(r => { r.state = false; });
    actionMessage = "Mematikan semua lampu.";
    matched = true;

    // Publish all
    if (dbState.mqttConnected && mqttClient) {
      dbState.relays.filter(r => r.id <= 4).forEach(r => {
        mqttClient?.publish(getTopicForId(r.id), "OFF", { qos: 1, retain: true });
      });
      addLog("success", `[MQTT Publish] Mempublikasikan semua lampu: OFF`);
    }
  } else {
    // Check single relays and variations
    const relayKeywords = [
      { id: 1, name: "Relay Lampu 1", onTerms: ["lampu satu", "lampu 1", "relay satu", "relay 1", "satu hidup", "satu nyala", "nyala satu"], offTerms: ["matikan satu", "mati 1", "lampu satu mati", "relay 1 mati", "relay 1 off", "satu mati"] },
      { id: 2, name: "Relay Lampu 2", onTerms: ["lampu dua", "lampu 2", "relay dua", "relay 2", "dua hidup", "dua nyala", "nyala dua"], offTerms: ["matikan dua", "mati 2", "lampu dua mati", "relay 2 mati", "relay 2 off", "dua mati"] },
      { id: 3, name: "Relay Lampu 3", onTerms: ["lampu tiga", "lampu 3", "relay tiga", "relay 3", "tiga hidup", "tiga nyala", "nyala tiga"], offTerms: ["matikan tiga", "mati 3", "lampu tiga mati", "relay 3 mati", "relay 3 off", "tiga mati"] },
      { id: 4, name: "Relay Lampu 4", onTerms: ["lampu empat", "lampu 4", "relay empat", "relay 4", "empat hidup", "empat nyala", "nyala empat"], offTerms: ["matikan empat", "mati 4", "lampu empat mati", "relay 4 mati", "relay 4 off", "empat mati"] },
      { id: 5, name: "Variasi Lampu 1", onTerms: ["variasi satu", "variasi 1", "lampu variasi satu", "variasi 1 hidup", "variasi 1 nyala", "nyala variasi 1"], offTerms: ["matikan variasi satu", "variasi 1 mati", "variasi 1 off", "variasi satu mati"] },
      { id: 6, name: "Variasi Lampu 2", onTerms: ["variasi dua", "variasi 2", "lampu variasi dua", "variasi 2 hidup", "variasi 2 nyala", "nyala variasi 2"], offTerms: ["matikan variasi dua", "variasi 2 mati", "variasi 2 off", "variasi dua mati"] },
    ];

    for (const rKey of relayKeywords) {
      // Check turn on
      const isTurnOn = findMatch(rKey.onTerms) || (findMatch(["hidup", "nyala", "on", "aktif"]) && findMatch([String(rKey.id), rKey.name]));
      // Check turn off
      const isTurnOff = findMatch(rKey.offTerms) || (findMatch(["mati", "off", "nonaktif", "padam"]) && findMatch([String(rKey.id), rKey.name]));

      if (isTurnOn) {
        const r = dbState.relays.find(ref => ref.id === rKey.id);
        if (r) {
          r.state = true;
          actionMessage = `Voice Command: Menyalakan ${r.name}`;
          matched = true;

          if (dbState.mqttConnected && mqttClient) {
            mqttClient.publish(getTopicForId(r.id), "ON", { qos: 1, retain: true });
            addLog("success", `[MQTT Publish] Mengirim ${r.name}: ON`);
          }
          break;
        }
      } else if (isTurnOff) {
        const r = dbState.relays.find(ref => ref.id === rKey.id);
        if (r) {
          r.state = false;
          actionMessage = `Voice Command: Mematikan ${r.name}`;
          matched = true;

          if (dbState.mqttConnected && mqttClient) {
            mqttClient.publish(getTopicForId(r.id), "OFF", { qos: 1, retain: true });
            addLog("success", `[MQTT Publish] Mengirim ${r.name}: OFF`);
          }
          break;
        }
      }
    }
  }

  if (matched) {
    addLog("success", actionMessage);
    res.json({ success: true, matched: true, action: actionMessage, dbState });
  } else {
    addLog("warning", `Perintah tidak dikenal: "${transcript}"`);
    res.json({ success: true, matched: false, message: "Perintah tidak dikenali, coba ucapkan 'nyalakan lampu 1' atau 'matikan semua'" });
  }
});


// ==========================================
// VITE DEV / PRODUCTION HANDLERS
// ==========================================

async function start() {
  if (process.env.NODE_ENV !== "production") {
    // Dev with Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving static files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
