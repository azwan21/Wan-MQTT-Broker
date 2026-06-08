export interface RelayState {
  id: number;
  name: string;
  state: boolean;
  pin: string; // information for ESP8266 pin matching
}

export interface MQTTConfig {
  server: string;
  port: number;
  clientId: string;
  user: string;
  pass: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
}

export interface SystemState {
  relays: RelayState[];
  mqttConnected: boolean;
  mqttConnecting: boolean;
  selectedBroker: string;
  config: MQTTConfig;
  logs: LogEntry[];
  buttonStyle: "neon" | "minimal";
  temperature?: string;
  humidity?: string;
}
