/*
 * ESP32-CAM -> Monitor de anaquel (POST HTTP de imagenes JPEG).
 *
 * Envia una captura cada SEND_INTERVAL_MS al backend, que decide cuando
 * analizarla con IA. El firmware NO espera el resultado del analisis:
 * solo entrega la imagen (el backend responde 202 Accepted en milisegundos).
 *
 * Ajusta la configuracion y adapta los pines a tu placa si no es AI-Thinker.
 */

#include "esp_camera.h"
#include <HTTPClient.h>
#include <WiFi.h>

// ================== CONFIGURACION ==================
const char *WIFI_SSID = "TU_WIFI";
const char *WIFI_PASSWORD = "TU_PASSWORD";

// URL publica del backend en Dokploy (HTTP, sin TLS para simplificar).
const char *SERVER_URL = "http://MI_DOMINIO_O_IP:5000/analizar-anaquel";

// Debe coincidir con una entrada `id:clave` de DEVICE_KEYS en el backend.
const char *DEVICE_KEY = "cambia-esta-clave";

// Frecuencia de captura/envio (la ingesta es barata; el backend analiza aparte).
const unsigned long SEND_INTERVAL_MS = 60000UL; // 1 minuto
// ===================================================

// ===== Pines AI-Thinker ESP32-CAM =====
#define PWDN_GPIO_NUM 32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 0
#define SIOD_GPIO_NUM 26
#define SIOC_GPIO_NUM 27
#define Y9_GPIO_NUM 35
#define Y8_GPIO_NUM 34
#define Y7_GPIO_NUM 39
#define Y6_GPIO_NUM 36
#define Y5_GPIO_NUM 21
#define Y4_GPIO_NUM 19
#define Y3_GPIO_NUM 18
#define Y2_GPIO_NUM 5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM 23
#define PCLK_GPIO_NUM 22

unsigned long previousMillis = 0;

bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.frame_size = FRAMESIZE_SVGA; // 800x600: buen balance detalle/transmision
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_LATEST;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 12;
  config.fb_count = 1;

  if (psramFound()) {
    config.jpeg_quality = 10;
    config.fb_count = 2;
    config.grab_mode = CAMERA_GRAB_LATEST;
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Fallo init de camara: 0x%x\n", err);
    return false;
  }

  sensor_t *s = esp_camera_sensor_get();
  if (s->id.PID == OV3660_PID) {
    s->set_vflip(s, 1);
    s->set_brightness(s, 1);
    s->set_saturation(s, -2);
  }
  return true;
}

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  WiFi.setSleep(false);
  Serial.print("Conectando WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nWiFi conectado. IP: %s\n", WiFi.localIP().toString().c_str());
}

void sendFrameToServer() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Error: no se pudo capturar el frame");
    return;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "image/jpeg");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  http.setTimeout(5000);

  int code = http.POST(fb->buf, fb->len);
  if (code > 0) {
    Serial.printf("Frame enviado. HTTP %d\n", code);
  } else {
    Serial.printf("Fallo HTTP: %s\n", http.errorToString(code).c_str());
  }

  http.end();
  esp_camera_fb_return(fb);
}

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  delay(200);

  if (!initCamera()) {
    Serial.println("Sin camara; reinicio en 5 s");
    delay(5000);
    ESP.restart();
  }

  connectWiFi();
}

void loop() {
  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= SEND_INTERVAL_MS) {
    previousMillis = currentMillis;
    if (WiFi.status() == WL_CONNECTED) {
      sendFrameToServer();
    } else {
      Serial.println("WiFi desconectado; se omite el envio");
      connectWiFi();
    }
  }
}
