#!/bin/bash

# ==============================================================================
# Script otomatisasi instalasi & deployment Simulator PLTA Modbus SCADA di Debian 12.6
# ==============================================================================

# Definisikan warna untuk output log
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Bersihkan layar dan tampilkan header
clear
echo -e "${BLUE}======================================================================${NC}"
echo -e "${GREEN}    SERVIS DEPLOYMENT SIMULATOR PLTA MODBUS SCADA - DEBIAN 12.6       ${NC}"
echo -e "${BLUE}======================================================================${NC}"
echo ""

# Pastikan script dijalankan sebagai root atau dengan sudo
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: Script ini harus dijalankan sebagai ROOT atau dengan 'sudo'.${NC}"
  echo "Silakan jalankan kembali menggunakan: sudo ./deploy_debian.sh"
  exit 1
fi

# Tentukan direktori instalasi saat ini
INSTALL_DIR=$(pwd)
echo -e "${BLUE}[1/6] Memeriksa dependensi sistem Debian...${NC}"

# Update daftar paket APT
echo -e "${YELLOW}Mengupdate katalog paket APT...${NC}"
apt-get update -y

# Install dependensi dasar yang dibutuhkan
echo -e "${YELLOW}Menginstal utilitas dasar (curl, git, gnupg, build-essential)...${NC}"
apt-get install -y curl git gnupg build-essential python3 python3-pip python3-venv python3-full -y

# Menambah repositori NodeSource LTS untuk menginstal Node.js v20 di Debian 12 Bookworm
echo -e "${BLUE}[2/6] Mempersiapkan repositori Node.js LTS (v20)...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${YELLOW}Mengunduh & mengonfigurasi repositori resmi NodeSource v20...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  echo -e "${YELLOW}Menginstal Node.js & npm...${NC}"
  apt-get install -y nodejs
else
  echo -e "${GREEN}Node.js sudah terinstal: $(node -v)${NC}"
fi

# Menginstal dependensi Python pyModbusTCP untuk simulator Modbus Server
echo -e "${BLUE}[3/6] Menginstal library pendukung Python Modbus Server...${NC}"
python3 -m pip install pyModbusTCP --break-system-packages 2>/dev/null || pip3 install pyModbusTCP

# Menginstal paket proyek Node.js dari package.json
echo -e "${BLUE}[4/6] Menginstal package dependencies (npm)...${NC}"
if [ -f "package.json" ]; then
  echo -e "${YELLOW}Menjalankan 'npm install' di: ${INSTALL_DIR}${NC}"
  npm install
else
  echo -e "${RED}Error: file package.json tidak ditemukan di folder saat ini!${NC}"
  exit 1
fi

# Build web application ke dalam format produksi static yang siap disajikan
echo -e "${BLUE}[5/6] Membangun aplikasi produksi (Build production)...${NC}"
echo -e "${YELLOW}Menjalankan 'npm run build'...${NC}"
npm run build

if [ ! -d "dist" ]; then
  echo -e "${RED}Error: Proses build gagal. Folder 'dist' tidak terbentuk!${NC}"
  exit 1
fi

echo -e "${GREEN}Build berhasil! Hasil kompilasi siap di /dist.${NC}"

# ==============================================================================
# 6. CONFIGURATION OF SYSTEMD SERVICES
# ==============================================================================
echo -e "${BLUE}[6/6] Menyiapkan integrasi Systemd Service agar program berjalan otomatis latar belakang...${NC}"

# Buat Systemd service untuk Node.js Web Server (Express / API SCADA)
cat <<EOF > /etc/systemd/system/plta-scada.service
[Unit]
Description=Aplikasi Web Monitoring SCADA PLTA (Express + React)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Buat Systemd service untuk Python Modbus TCP Simulator
cat <<EOF > /etc/systemd/system/plta-modbus.service
[Unit]
Description=Eemulator Modbus TCP Server PLTA (Python Core)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/python3 ${INSTALL_DIR}/modbus_server.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Reload daemon untuk mendaftarkan service baru
echo -e "${YELLOW}Mereload systemd manager daemon...${NC}"
systemctl daemon-reload

# Enable dan jalankan service secara langsung
echo -e "${YELLOW}Mengaktifkan dan menjalankan layanan plta-scada & plta-modbus...${NC}"
systemctl enable plta-scada.service --now
systemctl enable plta-modbus.service --now

echo ""
echo -e "${GREEN}======================================================================${NC}"
echo -e "${GREEN}            PROSES INSTALASI DAN DEPLOYMENT SELESAI!                  ${NC}"
echo -e "${GREEN}======================================================================${NC}"
echo ""
echo -e "Aplikasi Anda sekarang terpasang secara permanen di Debian 12.6."
echo -e ""
echo -e "${YELLOW}Detail Port Layanan Operasional:${NC}"
echo -e "  1. ${BLUE}SCADA Web Interface & API Port:${NC} http://<IP-DEBIAN-ANDA>:3000"
echo -e "  2. ${BLUE}Modbus TCP Server Port (PLC):${NC} <IP-DEBIAN-ANDA>:1502 (Register 0, 1, 2)"
echo -e ""
echo -e "${YELLOW}Perintah Berguna Systemd untuk Manajemen Layanan:${NC}"
echo -e "  - ${BLUE}Cek Status Layanan Web:${NC}      systemctl status plta-scada"
echo -e "  - ${BLUE}Cek Status Layanan Modbus:${NC}   systemctl status plta-modbus"
echo -e "  - ${BLUE}Melihat Log Web Realtime:${NC}    journalctl -u plta-scada -f"
echo -e "  - ${BLUE}Melihat Log Modbus Realtime:${NC} journalctl -u plta-modbus -f"
echo -e "  - ${BLUE}Menghentikan Layanan:${NC}        systemctl stop plta-scada plta-modbus"
echo -e "  - ${BLUE}Memulai Ulang Layanan:${NC}       systemctl restart plta-scada plta-modbus"
echo ""
echo -e "${GREEN}Selamat melakukan instalasi di mesin Debian 12.6.${NC}"
echo -e "${BLUE}======================================================================${NC}"
