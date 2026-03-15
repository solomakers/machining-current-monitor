#!/bin/bash
set -euo pipefail

# ==============================================================================
# EnOcean Current Monitor - Receiver Setup Script for Raspberry Pi
# ==============================================================================
# Usage: curl -sL <raw-url> | bash
#   or:  bash scripts/setup-receiver.sh
# ==============================================================================

REPO_URL="https://github.com/solomakers/machining-current-monitor.git"
INSTALL_DIR="$HOME/machining-current-monitor"
NODE_VERSION="22"

echo "========================================"
echo " EnOcean Current Monitor - Receiver Setup"
echo "========================================"

# ---------- 1. System packages ----------
echo ""
echo "[1/6] Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq git curl build-essential

# ---------- 2. Node.js via nvm ----------
echo ""
echo "[2/6] Installing Node.js $NODE_VERSION via nvm..."
if [ ! -d "$HOME/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi

export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

nvm install "$NODE_VERSION"
nvm use "$NODE_VERSION"
nvm alias default "$NODE_VERSION"

echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# ---------- 3. Clone or update repo ----------
echo ""
echo "[3/6] Setting up repository..."
if [ -d "$INSTALL_DIR" ]; then
  echo "Repository exists. Pulling latest..."
  cd "$INSTALL_DIR"
  git pull
else
  echo "Cloning repository..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ---------- 4. Install dependencies & build ----------
echo ""
echo "[4/6] Installing dependencies and building..."
cd "$INSTALL_DIR"
npm install

# Build packages first (domain, config), then receiver
cd "$INSTALL_DIR/packages/domain" && npx tsc
cd "$INSTALL_DIR/packages/config" && npx tsc
cd "$INSTALL_DIR/apps/receiver" && npx tsc
cd "$INSTALL_DIR"
echo "Build complete."

# ---------- 5. Setup .env ----------
echo ""
echo "[5/6] Setting up configuration..."
RECEIVER_DIR="$INSTALL_DIR/apps/receiver"
if [ ! -f "$RECEIVER_DIR/.env" ]; then
  cp "$RECEIVER_DIR/.env.example" "$RECEIVER_DIR/.env"
  echo "Created .env from template. Please edit: $RECEIVER_DIR/.env"
else
  echo ".env already exists. Skipping."
fi

# Create spool directory
mkdir -p "$RECEIVER_DIR/spool"

# ---------- 6. Install system services ----------
echo ""
echo "[6/6] Installing system services..."

# udev rule for USB 400J
sudo cp "$INSTALL_DIR/deploy/99-usb400j.rules" /etc/udev/rules.d/
sudo udevadm control --reload-rules
sudo udevadm trigger
echo "udev rule installed. USB 400J will appear as /dev/enocean-usb400j"

# systemd service
sudo cp "$INSTALL_DIR/deploy/receiver.service" /etc/systemd/system/mcm-receiver.service

# Update ExecStart path with actual nvm node path
NODE_PATH=$(which node)
sudo sed -i "s|ExecStart=.*|ExecStart=$NODE_PATH --import tsx $RECEIVER_DIR/src/index.ts|" /etc/systemd/system/mcm-receiver.service
sudo sed -i "s|WorkingDirectory=.*|WorkingDirectory=$RECEIVER_DIR|" /etc/systemd/system/mcm-receiver.service
sudo sed -i "s|EnvironmentFile=.*|EnvironmentFile=$RECEIVER_DIR/.env|" /etc/systemd/system/mcm-receiver.service
sudo sed -i "s|ReadWritePaths=.*|ReadWritePaths=$RECEIVER_DIR/spool|" /etc/systemd/system/mcm-receiver.service
sudo sed -i "s|User=pi|User=$USER|" /etc/systemd/system/mcm-receiver.service
sudo sed -i "s|ProtectHome=read-only|ProtectHome=read-only\nReadOnlyPaths=$INSTALL_DIR|" /etc/systemd/system/mcm-receiver.service

sudo systemctl daemon-reload
sudo systemctl enable mcm-receiver
echo "systemd service installed and enabled."

# ---------- Done ----------
echo ""
echo "========================================"
echo " Setup complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Edit .env file:"
echo "     nano $RECEIVER_DIR/.env"
echo ""
echo "  2. Plug in USB 400J and verify:"
echo "     ls -l /dev/enocean-usb400j"
echo ""
echo "  3. Start the service:"
echo "     sudo systemctl start mcm-receiver"
echo ""
echo "  4. Check logs:"
echo "     journalctl -u mcm-receiver -f"
echo ""
