let device, characteristic;

const connectBtn = document.getElementById('connectBtn');
const status = document.getElementById('status');
const positionDisplay = document.getElementById('position');

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
    connectBtn.disabled = true;
  } catch (e) {
    console.error(e);
    status.textContent = `Connection failed: ${e.message}`;
    alert(`Connection failed: ${e.message}`);
  }
});

// Joystick logic
const canvas = document.getElementById('joystick');
const ctx = canvas.getContext('2d');
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const radius = 180;
let x = 0, y = 0;
let isDragging = false;

function drawOctagon(x, y, radius) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const px = x + radius * Math.cos(angle);
    const py = y + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawJoystick() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Outer octagon (base)
  drawOctagon(centerX, centerY, radius);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#333';
  ctx.fill();
  // Inner deadzone octagon
  drawOctagon(centerX, centerY, 40);
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Joystick shaft (line from center to handle)
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + x, centerY + y);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.stroke();
  // Joystick handle
  drawOctagon(centerX + x, centerY + y, 35);
  ctx.fillStyle = '#007bff';
  ctx.fill();
  ctx.strokeStyle = '#0056b3';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Handle grip lines
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const hx = centerX + x + 25 * Math.cos(angle);
    const hy = centerY + y + 25 * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(centerX + x, centerY + y);
    ctx.lineTo(hx, hy);
    ctx.stroke();
  }
}

function updatePosition(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const dx = clientX - rect.left - centerX;
  const dy = clientY - rect.top - centerY;
  const angle = Math.atan2(dy, dx);
  const absCos = Math.abs(Math.cos(angle));
  const absSin = Math.abs(Math.sin(angle));
  const maxDist = radius / Math.max(absCos, absSin);
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance > maxDist) {
    x = (dx / distance) * maxDist;
    y = (dy / distance) * maxDist;
  } else {
    x = dx;
    y = dy;
  }
  drawJoystick();
  const normX = Math.round((x / radius) * 100);
  const normY = Math.round((y / radius) * 100);
  positionDisplay.textContent = `Position: X: ${normX}, Y: ${normY}`;
  sendJoystick(normX, normY);
}

async function sendJoystick(xVal, yVal) {
  if (!characteristic) return;
  const data = `X:${xVal},Y:${yVal}\n`;
  try {
    const encoder = new TextEncoder();
    await characteristic.writeValue(encoder.encode(data));
  } catch (e) {
    console.error('Send failed:', e);
  }
}

canvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  updatePosition(e.clientX, e.clientY);
});

canvas.addEventListener('mousemove', (e) => {
  if (isDragging) {
    updatePosition(e.clientX, e.clientY);
  }
});

canvas.addEventListener('mouseup', () => {
  isDragging = false;
  x = 0;
  y = 0;
  drawJoystick();
  positionDisplay.textContent = 'Position: X: 0, Y: 0';
  sendJoystick(0, 0);
});

canvas.addEventListener('mouseleave', () => {
  if (isDragging) {
    isDragging = false;
    // Keep current position instead of snapping to 0
    // x and y remain as is
    drawJoystick();
    const normX = 0;
    const normY = 0;
    positionDisplay.textContent = `Position: X: ${normX}, Y: ${normY}`;
    // Don't send 0,0
  }
});

// Touch events for mobile
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  isDragging = true;
  updatePosition(e.touches[0].clientX, e.touches[0].clientY);
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (isDragging) {
    updatePosition(e.touches[0].clientX, e.touches[0].clientY);
  }
});

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  isDragging = false;
  x = 0;
  y = 0;
  drawJoystick();
  positionDisplay.textContent = 'Position: X: 0, Y: 0';
  sendJoystick(0, 0);
});

drawJoystick();

const joystickCode = `#include <SoftwareSerial.h>

SoftwareSerial BLE(10, 11); // RX, TX for HM-10

// H-Bridge pins
int IN1 = 2, IN2 = 3, IN3 = 4, IN4 = 5;

int leftSpeed = 0, rightSpeed = 0;

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
    String data = BLE.readStringUntil('\n');
    if (data.startsWith("X:") && data.indexOf(",Y:") > 0) {
      int commaIndex = data.indexOf(',');
      int x = data.substring(2, commaIndex).toInt();
      int y = data.substring(commaIndex + 3).toInt();
      controlMotors(x, y);
    }
  }
}

void controlMotors(int x, int y) {
  // x: -100 to 100 (left-right), y: -100 to 100 (forward-backward)
  int forward = y;
  int turn = x;

  leftSpeed = constrain(forward + turn, -100, 100);
  rightSpeed = constrain(forward - turn, -100, 100);

  setMotor(0, leftSpeed);  // Left motor
  setMotor(1, rightSpeed); // Right motor
}

void setMotor(int motor, int speed) {
  int in1, in2;
  if (motor == 0) { in1 = IN1; in2 = IN2; } // Left
  else { in1 = IN3; in2 = IN4; } // Right

  if (speed > 0) {
    analogWrite(in1, map(speed, 0, 100, 0, 255));
    digitalWrite(in2, LOW);
  } else if (speed < 0) {
    digitalWrite(in1, LOW);
    analogWrite(in2, map(-speed, 0, 100, 0, 255));
  } else {
    digitalWrite(in1, LOW);
    digitalWrite(in2, LOW);
  }
}
`;

document.getElementById('arduinoCode').textContent = joystickCode;