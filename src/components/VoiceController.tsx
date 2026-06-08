import { useState, useEffect, useRef } from "react";
import { Mic, Volume2, Sparkles, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface VoiceControllerProps {
  onCommandReceived: (transcript: string) => Promise<any>;
  onLogLocal: (level: "info" | "success" | "warning" | "error", message: string) => void;
}

export default function VoiceController({ onCommandReceived, onLogLocal }: VoiceControllerProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [statusMessage, setStatusMessage] = useState("Siap Mendengar");
  const [recognitionError, setRecognitionError] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(isListening);

  const toggleListeningRef = useRef<() => void>(() => {});
  
  // Sync state ref to avoid stale closures in hotkeys
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Keep toggleListening function ref updated for keydown handlers
  useEffect(() => {
    toggleListeningRef.current = toggleListening;
  });

  // Premium text-to-speech engine
  const speakText = (msg: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel(); // Cancel any speech currently playing
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.lang = "id-ID"; // Standard Indonesian language code
      utterance.rate = 1.05; // Slightly fast for a smart tech-assistant style
      utterance.pitch = 1.0;

      // Find an Indonesian speaker voice if available
      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find((v) => v.lang.startsWith("id"));
      if (idVoice) {
        utterance.voice = idVoice;
      }
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    // Check local speech recognition capability
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "id-ID";

      rec.onstart = () => {
        setIsListening(true);
        setRecognitionError("");
        setTranscript("");
        setStatusMessage("Mendengarkan...");
        onLogLocal("info", "Mulai mendengarkan perintah suara...");
      };

      rec.onerror = (event: any) => {
        console.error("Speech recognition error:", event);
        let errorMsg = `Gagal mendeteksi suara: ${event.error}`;
        if (event.error === "not-allowed") {
          errorMsg = "Akses mikrofon ditolak! Izinkan mikrofon di browser Anda.";
        }
        setRecognitionError(errorMsg);
        setIsListening(false);
        setStatusMessage("Gagal");
        onLogLocal("error", errorMsg);
        speakText("Maaf, akses mikrofon tidak diizinkan.");
      };

      rec.onend = () => {
        setIsListening(false);
        setTimeout(() => {
          setStatusMessage("Siap Mendengar");
        }, 1500);
      };

      rec.onresult = async (event: any) => {
        const resultText = event.results[0][0].transcript;
        setTranscript(resultText);
        setIsListening(false);
        setStatusMessage("Memproses...");

        onLogLocal("success", `Suara terdeteksi: "${resultText}"`);

        try {
          // Explicitly turn off recognition audio capturing immediately
          try {
            rec.stop();
          } catch (e) {}

          // Send recognized text to full-stack service via single unified callback
          const data = await onCommandReceived(resultText);

          if (data) {
            if (data.matched) {
              // Action speech feedback (e.g. "Menyalakan semua perangkat")
              speakText(data.action);
            } else {
              // Command not recognized speech feedback
              const failMsg = `Asisten tidak mengenali perintah: ${resultText}`;
              onLogLocal("warning", failMsg);
              speakText(`Maaf, perintah ${resultText} tidak cocok.`);
            }
          }
        } catch (err: any) {
          console.error("Gagal mengirim perintah suara ke server:", err);
          onLogLocal("error", "Koneksi asisten suara ke server gagal.");
          speakText("Maaf, terjadi gangguan koneksi ke server.");
        }
      };

      recognitionRef.current = rec;
    } else {
      console.warn("Speech recognition not supported in this browser.");
    }
  }, [onCommandReceived, onLogLocal]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      onLogLocal(
        "error",
        "Perekam suara tidak didukung di browser ini. Harap pakai browser Chrome atau Safari modern."
      );
      setRecognitionError("Browser Anda tidak mendukung speech recognition natively.");
      speakText("Browser Anda tidak mendukung layanan pengenalan suara.");
      return;
    }

    if (isListeningRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setIsListening(false);
      setStatusMessage("Perekaman berhenti");
      onLogLocal("info", "Perekaman suara dihentikan oleh pengguna.");
    } else {
      try {
        setTranscript("");
        recognitionRef.current.start();
      } catch (err: any) {
        console.error(err);
        onLogLocal("error", `Gagal memulai pendeteksian suara: ${err.message}`);
      }
    }
  };

  // Keyboard accessibility handler: toggle on SPACE pressed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only fire when Space is pressed
      if (e.code === "Space" || e.key === " ") {
        // Exclude search inputs or drop downs to prevent broken accessibility
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }

        e.preventDefault(); // Stop scrolling down on page
        toggleListeningRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      id="voice-controller-panel"
      className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
    >
      {/* Visual background ambient glow */}
      <div className="absolute right-0 top-0 h-32 w-32 bg-emerald-500/3 blur-3xl pointer-events-none" />
      <div className="absolute left-0 bottom-0 h-32 w-32 bg-teal-500/3 blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-800/70 pb-4 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <h2 className="text-md font-sans font-bold text-white flex items-center gap-2 uppercase tracking-wide">
            <Volume2 className="h-5 w-5 text-emerald-400" /> Voice Assist IoT
          </h2>
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="text-slate-400 hover:text-white hover:bg-slate-800/50 p-1.5 rounded-lg transition-all cursor-pointer"
          title="Panduan Perintah"
        >
          <HelpCircle className="h-5 w-5 text-slate-400" />
        </button>
      </div>

      {showHelp && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-6 p-4 rounded-2xl bg-slate-950 border border-slate-800/85 text-xs text-slate-300 space-y-2 leading-relaxed font-mono"
        >
          <p className="font-semibold text-emerald-400 flex items-center gap-1.5 uppercase text-[10px] tracking-wider mb-2">
            <Sparkles className="h-3.5 w-3.5" /> Panduan Perintah Bahasa Indonesia:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10.5px]">
            <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
              <span className="text-slate-400 font-bold text-[9.5px] uppercase tracking-wider block mb-1">LAMP CONTROL</span>
              <li><code className="text-emerald-400">nyalakan lampu 1</code></li>
              <li><code className="text-emerald-400">matikan lampu 2</code></li>
              <li><code className="text-emerald-400">nyalakan variasi 1</code></li>
              <li><code className="text-emerald-400">matikan variasi 2</code></li>
            </div>
            <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
              <span className="text-slate-400 font-bold text-[9.5px] uppercase tracking-wider block mb-1">MASTER CONTROLS</span>
              <li><code className="text-teal-400">nyalakan semua</code></li>
              <li><code className="text-teal-400">matikan semua</code></li>
              <li><code className="text-teal-400">semua on / off</code></li>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 italic mt-3">
            * Layanan asisten didesain cerdas mengenali suara natural dengan dialek lisan Indonesia.
          </p>
        </motion.div>
      )}

      {/* Main listening visual arena */}
      <div className="flex flex-col items-center justify-center p-8 bg-slate-950 border border-slate-850/80 rounded-2xl">
        
        {/* Waveforms & Text display */}
        <div className="h-16 flex items-center justify-center gap-1.5 mb-6 w-full text-center">
          <AnimatePresence mode="popLayout">
            {isListening ? (
              <div className="flex items-center gap-1.5">
                {[0.4, 0.9, 0.6, 1.2, 0.5, 0.8, 1.1, 0.3].map((delay, index) => (
                  <motion.div
                    key={index}
                    animate={{ height: [8, 42, 8] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.75,
                      delay: delay,
                    }}
                    className="w-1.5 rounded-full bg-emerald-500 shadow-[0_0_12px_#10b981]"
                  />
                ))}
              </div>
            ) : (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-slate-400 max-w-sm font-semibold tracking-wide italic font-sans animate-fade-in text-slate-300 pointer-events-none"
              >
                {transcript ? `"${transcript}"` : "Tekan tombol mikrofon atau tahan tombol SPASI untuk berbicara..."}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Eye catching glowing Mic button trigger */}
        <motion.button
          id="mic-trigger-btn"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleListening}
          className={`h-20 w-20 rounded-full flex items-center justify-center cursor-pointer shadow-xl transition-all duration-300 group border relative ${
            isListening
              ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.55)]"
              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]"
          }`}
        >
          {isListening && (
            <span className="absolute inset-0 rounded-full border border-emerald-400 animate-ping opacity-60" />
          )}
          <Mic className={`h-8 w-8 ${isListening ? "scale-110" : "group-hover:scale-110 duration-200"}`} />
        </motion.button>

        {/* Interactive current status label */}
        <div className="mt-4 flex flex-col items-center">
          <span
            className={`text-xs font-mono font-bold tracking-wider uppercase px-3 py-1 rounded-full ${
              isListening
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-slate-900 text-slate-400 border border-slate-800"
            }`}
          >
            {statusMessage}
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-2 uppercase tracking-widest">
            HOTKEY: [SPASI] UNTUK AKTIF / NONAKTIF
          </span>
        </div>

        {recognitionError && (
          <div className="mt-5 p-3 bg-red-950/40 border border-red-900/55 rounded-xl text-xs text-red-300 font-mono text-center max-w-sm">
            {recognitionError}
          </div>
        )}
      </div>
    </div>
  );
}
