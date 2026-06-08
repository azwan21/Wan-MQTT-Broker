// Pastikan Anda sudah menginstal library berikut melalui Library Manager di Arduino IDE:
// PubSubClient oleh Nick O'Leary
// DHT sensor library oleh Adafruit
// Adafruit Unified Sensor oleh Adafruit

#if defined(ESP8266)
#include <ESP8266WiFi.h>
#elif defined(ESP32)
#include <WiFi.h>
#endif

#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include "DHT.h"

// ================= PENGATURAN WIFI =================
const char* ssid = "Rumah Panggung Emak";
const char* password = "tahunbaru2026";

// ================ BROKER MULTI-PROFILE ============
// 1 = MyQTTHub, 2 = Ably Realtime, 3 = Flespi IO
int active_broker = 1;

// Profile 1: MyQTTHub Config (Bisa Diubah via Web Setup)
const char* config_myqtthub_server = "node02.myqtthub.com";
const int config_myqtthub_port = 8883;
const char* config_myqtthub_client_id = "esp32_client";
const char* config_myqtthub_user = "esp";
const char* config_myqtthub_pass = "123";

// Profile 2: Ably Realtime Config (Default Kredensial)
const char* config_ably_server = "mqtt.ably.io";
const int config_ably_port = 8883;
const char* config_ably_client_id = "esp32_client";
const char* config_ably_user = "0mN64g.3lKvvg";
const char* config_ably_pass = "nlmpvU40Q-P5nF9zLVqd4l3VxhmSm-xYzWyUsAE-ra4";

// Profile 3: Flespi IO Config (Default Kredensial)
const char* config_flespi_server = "mqtt.flespi.io";
const int config_flespi_port = 8883;
const char* config_flespi_client_id = "esp32_flespi";
const char* config_flespi_user = "c6NuJ8uBd7CUeHIaMttGwNBPK3bN3NWhob0eCibSDfkXkhiXCqLU6aOAZnDDwdyT";
const char* config_flespi_pass = "";

// Dynamic buffers used by PubSubClient
char mqtt_server[64];
int mqtt_port;
char mqtt_client_id[64];
char mqtt_user[128];
char mqtt_pass[128];

// ================= PENGATURAN PIN ==================
#define RELAY1_PIN 25
#define RELAY2_PIN 26
#define RELAY3_PIN 27
#define RELAY4_PIN 14

// Pin Tambahan untuk Variasi Mode (Trigger HIGH/LOW)
#define VARIASI1_PIN 21
#define VARIASI2_PIN 22

#define DHTPIN 4
#define DHTTYPE DHT11

// ================= INISIALISASI ====================
WiFiClientSecure espClient;
PubSubClient client(espClient);
DHT dht(DHTPIN, DHTTYPE);

unsigned long lastMsg = 0;

// Penanda Mode Variasi Aktif
bool variasi1_active = false;
bool variasi2_active = false;
unsigned long lastVariasiTime = 0;
int variasiStep = 0;

void select_broker_profile() {
  if (active_broker == 1) {
    strcpy(mqtt_server, config_myqtthub_server);
    mqtt_port = config_myqtthub_port;
    strcpy(mqtt_client_id, config_myqtthub_client_id);
    strcpy(mqtt_user, config_myqtthub_user);
    strcpy(mqtt_pass, config_myqtthub_pass);
  } else if (active_broker == 2) {
    strcpy(mqtt_server, config_ably_server);
    mqtt_port = config_ably_port;
    strcpy(mqtt_client_id, config_ably_client_id);
    strcpy(mqtt_user, config_ably_user);
    strcpy(mqtt_pass, config_ably_pass);
  } else if (active_broker == 3) {
    strcpy(mqtt_server, config_flespi_server);
    mqtt_port = config_flespi_port;
    strcpy(mqtt_client_id, config_flespi_client_id);
    strcpy(mqtt_user, config_flespi_user);
    strcpy(mqtt_pass, config_flespi_pass);
  }
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("[WLAN] Menginisialisasi koneksi ke: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print("~");
  }

  Serial.println("");
  Serial.println("[WLAN] Tautan nirkabel berhasil terbentuk!");
  Serial.print("[WLAN] IP Node perangkat: ");
  Serial.println(WiFi.localIP());

  // Mengabaikan verifikasi sertifikat SSL agar koneksi lancar
  espClient.setInsecure();
}

void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.print("[INFO] Paket payload mendarat pada path (");
  Serial.print(topic);
  Serial.print(") => ");
  Serial.println(message);

  // Jika menerima instruksi beralih broker
  if (String(topic) == "kontrol/server") {
    int target_broker = message.toInt();
    if (target_broker >= 1 && target_broker <= 3) {
      if (target_broker == active_broker) {
        return; // Abaikan jika broker yang dituju sudah merupakan broker yang aktif
      }
      
      Serial.println();
      Serial.println("**********************************************");
      Serial.print("[SWITCH] Permintaan relokasi broker diterima. Target profil: ");
      if (target_broker == 1) Serial.println("MyQTTHub");
      else if (target_broker == 2) Serial.println("Ably Realtime");
      else if (target_broker == 3) Serial.println("Flespi IO");
      Serial.println("**********************************************");
      
      active_broker = target_broker;
      
      // Update parameter koneksi
      select_broker_profile();
      
      // Atur ulang server & port di PubSubClient
      client.setServer(mqtt_server, mqtt_port);
      
      // Putuskan koneksi saat ini untuk memicu reconnect ke broker baru pada loop berikutnya
      client.disconnect();
      return;
    }
  }

  // Jika menerima perintah manual pada relay, otomatis nonaktifkan mode variasi 
  // agar kondisi relay manual tidak bentrok dengan loop variasi yang sedang jalan
  if (String(topic).startsWith("kontrol/relay")) {
    variasi1_active = false;
    variasi2_active = false;
    digitalWrite(VARIASI1_PIN, HIGH);
    digitalWrite(VARIASI2_PIN, HIGH);
  }

  // Kendali Relay & Variasi (Active LOW: LOW = ON, HIGH = OFF)
  if (String(topic) == "kontrol/relay1") {
    if (message == "ON") digitalWrite(RELAY1_PIN, LOW);
    else if (message == "OFF") digitalWrite(RELAY1_PIN, HIGH);
  } else if (String(topic) == "kontrol/relay2") {
    if (message == "ON") digitalWrite(RELAY2_PIN, LOW);
    else if (message == "OFF") digitalWrite(RELAY2_PIN, HIGH);
  } else if (String(topic) == "kontrol/relay3") {
    if (message == "ON") digitalWrite(RELAY3_PIN, LOW);
    else if (message == "OFF") digitalWrite(RELAY3_PIN, HIGH);
  } else if (String(topic) == "kontrol/relay4") {
    if (message == "ON") digitalWrite(RELAY4_PIN, LOW);
    else if (message == "OFF") digitalWrite(RELAY4_PIN, HIGH);
  } else if (String(topic) == "kontrol/variasi1") {
    if (message == "ON") {
      variasi1_active = true;
      variasi2_active = false;
      variasiStep = 0;
      lastVariasiTime = millis();
      digitalWrite(VARIASI1_PIN, LOW);  // Aktifkan Pin Variasi 1 (Active-Low)
      digitalWrite(VARIASI2_PIN, HIGH); // Nonaktifkan Pin Variasi 2
    } else if (message == "OFF") {
      variasi1_active = false;
      digitalWrite(VARIASI1_PIN, HIGH);
      // Matikan seluruh relay utama saat variasi dinonaktifkan
      digitalWrite(RELAY1_PIN, HIGH);
      digitalWrite(RELAY2_PIN, HIGH);
      digitalWrite(RELAY3_PIN, HIGH);
      digitalWrite(RELAY4_PIN, HIGH);
    }
  } else if (String(topic) == "kontrol/variasi2") {
    if (message == "ON") {
      variasi2_active = true;
      variasi1_active = false;
      variasiStep = 0;
      lastVariasiTime = millis();
      digitalWrite(VARIASI2_PIN, LOW);  // Aktifkan Pin Variasi 2 (Active-Low)
      digitalWrite(VARIASI1_PIN, HIGH); // Nonaktifkan Pin Variasi 1
    } else if (message == "OFF") {
      variasi2_active = false;
      digitalWrite(VARIASI2_PIN, HIGH);
      // Matikan seluruh relay utama saat variasi dinonaktifkan
      digitalWrite(RELAY1_PIN, HIGH);
      digitalWrite(RELAY2_PIN, HIGH);
      digitalWrite(RELAY3_PIN, HIGH);
      digitalWrite(RELAY4_PIN, HIGH);
    }
  }
}

void reconnect() {
  while (!client.connected()) {
    // Muat profile parameter broker yang aktif
    select_broker_profile();
    
    Serial.println();
    Serial.println("====================================================");
    Serial.print("[KONEKSI] Menjajaki koneksi aman ke server: ");
    if (active_broker == 1)      Serial.print("MyQTTHub ~> ");
    else if (active_broker == 2) Serial.print("Ably Realtime ~> ");
    else if (active_broker == 3) Serial.print("Flespi IO ~> ");
    Serial.print(mqtt_server);
    Serial.print(":");
    Serial.print(mqtt_port);
    Serial.println();

    if (client.connect(mqtt_client_id, mqtt_user, mqtt_pass)) {
      Serial.print("[KONEKSI] Otentikasi sukses! Node terdaftar pada agregator ");
      if (active_broker == 1)      Serial.println("MyQTTHub");
      else if (active_broker == 2) Serial.println("Ably Realtime");
      else if (active_broker == 3) Serial.println("Flespi IO");
      Serial.println("====================================================");

      // Subscribe ke topik-topik kendali, sensor, dan singkronisasi beralih broker
      client.subscribe("kontrol/relay1");
      client.subscribe("kontrol/relay2");
      client.subscribe("kontrol/relay3");
      client.subscribe("kontrol/relay4");
      client.subscribe("kontrol/variasi1");
      client.subscribe("kontrol/variasi2");
      client.subscribe("kontrol/server");
      Serial.println("[SINKRONISASI] Subskripsi topik kendali telah aktif.");
    } else {
      Serial.print("[KONEKSI] Penolakan server, kode kesalahan: ");
      Serial.print(client.state());
      Serial.println(". Menginisialisasi ulang sistem dalam 5 detik...");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);

  Serial.println("\n\n");
  Serial.println("----------------------------------------");
  Serial.println("  BOOTING IOT MULTI-BROKER ESP MODULE");
  Serial.println("----------------------------------------");

  pinMode(RELAY1_PIN, OUTPUT);
  pinMode(RELAY2_PIN, OUTPUT);
  pinMode(RELAY3_PIN, OUTPUT);
  pinMode(RELAY4_PIN, OUTPUT);
  pinMode(VARIASI1_PIN, OUTPUT);
  pinMode(VARIASI2_PIN, OUTPUT);

  // Matikan semua relay dan variasi saat startup (Kondisi HIGH karena Active Low)
  digitalWrite(RELAY1_PIN, HIGH);
  digitalWrite(RELAY2_PIN, HIGH);
  digitalWrite(RELAY3_PIN, HIGH);
  digitalWrite(RELAY4_PIN, HIGH);
  digitalWrite(VARIASI1_PIN, HIGH);
  digitalWrite(VARIASI2_PIN, HIGH);

  dht.begin();
  setup_wifi();

  select_broker_profile();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();

  // ================= KONTROL VARIASI NON-BLOCKING (150ms delay) =================
  if (variasi1_active) {
    if (now - lastVariasiTime >= 150) {
      lastVariasiTime = now;
      int s = variasiStep % 4;
      if (s == 0) {
        // Lampu 1 & 4 ON bersamaan (LOW = Active Low), Lampu 2 & 3 OFF (HIGH)
        digitalWrite(RELAY1_PIN, LOW);
        digitalWrite(RELAY2_PIN, HIGH);
        digitalWrite(RELAY3_PIN, HIGH);
        digitalWrite(RELAY4_PIN, LOW);
      } else if (s == 1) {
        // Matikan bersamaan
        digitalWrite(RELAY1_PIN, HIGH);
        digitalWrite(RELAY2_PIN, HIGH);
        digitalWrite(RELAY3_PIN, HIGH);
        digitalWrite(RELAY4_PIN, HIGH);
      } else if (s == 2) {
        // Lampu 2 & 3 ON bersamaan, Lampu 1 & 4 OFF
        digitalWrite(RELAY1_PIN, HIGH);
        digitalWrite(RELAY2_PIN, LOW);
        digitalWrite(RELAY3_PIN, LOW);
        digitalWrite(RELAY4_PIN, HIGH);
      } else if (s == 3) {
        // Matikan bersamaan
        digitalWrite(RELAY1_PIN, HIGH);
        digitalWrite(RELAY2_PIN, HIGH);
        digitalWrite(RELAY3_PIN, HIGH);
        digitalWrite(RELAY4_PIN, HIGH);
      }
      variasiStep++;
    }
  } else if (variasi2_active) {
    if (now - lastVariasiTime >= 150) {
      lastVariasiTime = now;
      int s = variasiStep % 4;
      if (s == 0) {
        // Lampu 2 & 3 ON bersamaan, Lampu 1 & 4 OFF
        digitalWrite(RELAY1_PIN, HIGH);
        digitalWrite(RELAY2_PIN, LOW);
        digitalWrite(RELAY3_PIN, LOW);
        digitalWrite(RELAY4_PIN, HIGH);
      } else if (s == 1) {
        // Matikan bersamaan
        digitalWrite(RELAY1_PIN, HIGH);
        digitalWrite(RELAY2_PIN, HIGH);
        digitalWrite(RELAY3_PIN, HIGH);
        digitalWrite(RELAY4_PIN, HIGH);
      } else if (s == 2) {
        // Lampu 1 & 4 ON bersamaan, Lampu 2 & 3 OFF
        digitalWrite(RELAY1_PIN, LOW);
        digitalWrite(RELAY2_PIN, HIGH);
        digitalWrite(RELAY3_PIN, HIGH);
        digitalWrite(RELAY4_PIN, LOW);
      } else if (s == 3) {
        // Matikan bersamaan
        digitalWrite(RELAY1_PIN, HIGH);
        digitalWrite(RELAY2_PIN, HIGH);
        digitalWrite(RELAY3_PIN, HIGH);
        digitalWrite(RELAY4_PIN, HIGH);
      }
      variasiStep++;
    }
  }

  // Membaca dan mengirim data DHT11 setiap 5 detik
  if (now - lastMsg >= 5000) {
    lastMsg = now;

    float h = dht.readHumidity();
    float t = dht.readTemperature();

    if (isnan(h) || isnan(t)) {
      Serial.println("[SENSOR] Pembacaan DHT11 gagal/tidak valid.");
    } else {
      String suhu = String(t);
      String kelembaban = String(h);

      // Publish data ke topik MQTT agar dibaca Web
      client.publish("sensor/suhu", suhu.c_str());
      client.publish("sensor/kelembaban", kelembaban.c_str());

      Serial.print("[DATA RUTIN] ~> T: ");
      Serial.print(suhu);
      Serial.print(" °C | H: ");
      Serial.print(kelembaban);
      Serial.print(" % | Sesi: ");
      if (active_broker == 1) Serial.println("MyQTTHub");
      else if (active_broker == 2) Serial.println("Ably Realtime");
      else if (active_broker == 3) Serial.println("Flespi IO");
      else Serial.println("Tidak Diketahui");
    }
  }
}
