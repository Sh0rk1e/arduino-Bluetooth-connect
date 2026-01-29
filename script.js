let device, characteristic;

const connectBtn = document.getElementById('connectBtn');
const controls = document.getElementById('controls');
const status = document.getElementById('status');

connectBtn.addEventListener('click', async () => {
  if (!navigator.bluetooth) {
    alert('Web Bluetooth API not supported in this browser. Use Chrome or Edge.');
    return;
  }
  try {
    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['0000ffe0-0000-1000-8000-00805f9b34fb'] // HM-10 UART service
    });
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
    characteristic = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');
    status.textContent = 'Connected';
    controls.style.display = 'block';
    connectBtn.disabled = true;
  } catch (e) {
    console.error(e);
    status.textContent = `Connection failed: ${e.message}`;
    alert(`Connection failed: ${e.message}`);
  }
});

const buttons = {
  forwardBtn: 'F',
  backwardBtn: 'B',
  leftBtn: 'L',
  rightBtn: 'R',
  stopBtn: 'S'
};

for (const [id, cmd] of Object.entries(buttons)) {
  document.getElementById(id).addEventListener('click', () => sendCommand(cmd));
}

async function sendCommand(cmd) {
  if (!characteristic) return;
  try {
    await characteristic.writeValue(new Uint8Array([cmd.charCodeAt(0)]));
  } catch (e) {
    console.error('Send failed:', e);
  }
}

const codeTemplate = `#include <SoftwareSerial.h>

SoftwareSerial BLE(10, 11); // RX, TX for HM-10

// H-Bridge pins
int IN1 = {IN1}, IN2 = {IN2}, IN3 = {IN3}, IN4 = {IN4};

void setup() {
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  BLE.begin(9600);
  Serial.begin(9600);
}

void loop() {
  if (BLE.available()) {
    char cmd = BLE.read();
    switch (cmd) {
      case 'F': forward(); break;
      case 'B': backward(); break;
      case 'L': left(); break;
      case 'R': right(); break;
      case 'S': stop(); break;
    }
  }
}

void forward() { digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW); digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW); }
void backward() { digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH); digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH); }
void left() { digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH); digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW); }
void right() { digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW); digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH); }
void stop() { digitalWrite(IN1, LOW); digitalWrite(IN2, LOW); digitalWrite(IN3, LOW); digitalWrite(IN4, LOW); }
`;

function updateCode() {
  const in1 = document.getElementById('in1').value;
  const in2 = document.getElementById('in2').value;
  const in3 = document.getElementById('in3').value;
  const in4 = document.getElementById('in4').value;
  const code = codeTemplate
    .replace('{IN1}', in1)
    .replace('{IN2}', in2)
    .replace('{IN3}', in3)
    .replace('{IN4}', in4);
  document.getElementById('arduinoCode').textContent = code;
}

// Initial update
updateCode();

// Add event listeners to inputs
['in1', 'in2', 'in3', 'in4'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateCode);
});
