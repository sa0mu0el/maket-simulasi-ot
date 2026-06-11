#!/usr/bin/env python3
"""
PLTA Modbus TCP Server Emulator v2.0.0
This script runs a Modbus TCP server specifically designed for your PLTA simulator.
It hosts three main registers:
- Register 0 (Holding Register 40001): Water discharge / Debit Air 'Q' (0 to 100 m³/s)
- Register 1 (Holding Register 40002): Inlet Gate Status (0% to 100% OPEN)
- Register 2 (Holding Register 40003): Generator Temperature 'Suhu' (°C)

Physics Logic:
- The effective debit passing through the penstock is: Q_eff = Q * (Gate_Opening / 100.0)
- If Gate is Closed (Reg 1 = 0) or Debit is 0 (Reg 0 = 0), Turbine RPM goes to 0, temperature slowly cools down to ambient (30°C).
- If Gate is Open and Q_eff is high, turbine speed/RPM is high, causing generator temperature to climb.
- If Temperature reaches <= 200°C, it stays safe, but if it touches 200°C or higher, the generator 'EXPLODES' (meledak), setting Gate opening to 0% (tripped) and sounding safety warnings!

Prerequisites:
  pip install pyModbusTCP
Run:
  python3 modbus_server.py
"""

import sys
import time
import threading

# Dependency Check for pyModbusTCP
try:
    from pyModbusTCP.server import ModbusServer
except ImportError:
    print("\n" + "=" * 60)
    print("❌ ERROR: Modul 'pyModbusTCP' belum terinstall di komputer Debian Anda!")
    print("=" * 60)
    print("Untuk menginstallnya, silakan jalankan perintah berikut di terminal Anda:")
    print("\n    pip3 install pyModbusTCP")
    print("\nJika pip3 belum terinstall di Debian, install terlebih dahulu dengan:")
    print("\n    sudo apt update && sudo apt install python3-pip -y")
    print("    pip3 install pyModbusTCP")
    print("=" * 60 + "\n")
    sys.exit(1)

# Configuration
SERVER_HOST = "0.0.0.0"  # Listen on all local IP addresses including your 192.168.122.151
SERVER_PORT = 1502

# Initialize the Server
server = ModbusServer(host=SERVER_HOST, port=SERVER_PORT, no_block=True)

print("=" * 60)
print(f"Starting PLTA Modbus TCP Server on {SERVER_HOST}:{SERVER_PORT}")
print("Holding Register Mapping:")
print("  - [40001 / Address 0] : Debit Air (Q) (0 - 100 m³/s)")
print("  - [40002 / Address 1] : Gate / Pintu Air (0% - 100% Buka)")
print("  - [40003 / Address 2] : Suhu Generator (°C) (0 - 250 °C)")
print("=" * 60)

# Seed Initial Modbus Bank values
# Address 0: Q = 75 m3/s, Address 1: Gate = 100% (Open), Address 2: Temp = 45 °C
server.data_bank.set_holding_registers(0, [75, 100, 45])

def physical_simulation_loop():
    """
    Simulates real-time physics and updates holding registers at 1Hz frequency.
    """
    is_exploded = False
    
    while True:
        try:
            # Read current values from register space (users can also write to these registers from SCADA/Modbus clients)
            regs = server.data_bank.get_holding_registers(0, 3)
            if not regs or len(regs) < 3:
                # Fallback safeguard in case bank is uninitialized
                regs = [75, 100, 45]
                server.data_bank.set_holding_registers(0, regs)
                
            debit = regs[0]
            gate_opening = min(100, max(0, regs[1])) # Clamp 0 - 100%
            temp = regs[2]

            # Physical kinetics logic
            if is_exploded:
                # Reset explosion lock if temperature cools down below 100°C (auto-recovery)
                # or if the user manual-resets the temperature below 150°C from the SCADA control panel
                if temp < 100:
                    is_exploded = False
                    print("❇️ Modbus Server [AUTO-RESET]: System cooled down below 100°C. Resuming normal operation.")
                else:
                    # If exploded, freeze gate opening to 0% and water flow to 0
                    if gate_opening != 0 or debit != 0:
                        print("⚠️ Modbus Server [SAFETY]: System exploded! Forcing emergency shutdown.")
                        debit = 0
                        gate_opening = 0
                        server.data_bank.set_holding_registers(0, [0, 0])
                    
                    # Temperature slowly cools down after explosion towards ambient 40°C
                    if temp > 40:
                        temp -= 1.5
                    server.data_bank.set_holding_registers(2, [int(round(temp))])
                    
                    print(f"[STATUS] MELEDAK 🔥! Suhu cooling down: {int(round(temp))}°C | Q: {debit} m3/s | Gate: {gate_opening}%")
                    time.sleep(1.0)
                    continue

            # Calculate Effective flow rate
            effective_debit = debit * (gate_opening / 100.0)

            # Active kinetics when working normally:
            if effective_debit > 0:
                # RPM is proportional to effective water debit
                # If Q_eff > 75, generator operates in overload threshold! Temperature will increase rapidly.
                rpm_factor = effective_debit / 100.0  # Normalized 0.0 -> 1.0
                
                if effective_debit > 75:
                    # Heating rate matches high-overload RPM friction
                    heating_rate = 4.0 * rpm_factor
                    print(f"⚠️ Modbus Server [OVERLOAD ALERT]: Q_eff is {effective_debit:.1f} m3/s! High RPM heating generator...")
                elif effective_debit > 60:
                    # Friction warming climb
                    heating_rate = 1.6 * rpm_factor
                else:
                    # Stabilizes around a warm operating range of e.g. 50°C - 80°C
                    target_temp = 40.0 + (effective_debit * 0.7)
                    heating_rate = (target_temp - temp) * 0.1
                
                temp += heating_rate
            else:
                # Cooling down process when gate is closed or flow is zero
                cooling_rate = (30.0 - temp) * 0.08  # Cools towards ambient (30°C)
                temp += cooling_rate

            # Round temperature to integer for standard integer modbus registers
            int_temp = int(round(temp))
            int_temp = max(0, min(250, int_temp))  # clamp inside register range
            
            # Write updated temperature back to Modbus Register 2
            server.data_bank.set_holding_registers(2, [int_temp])

            # Check explosion limit condition >= 200°C
            if int_temp >= 200:
                is_exploded = True
                print("\n💥 BOOM!!! GENERATOR MELEDAK (MELTDOWN) di Suhu 200°C!")
                print("🚨 Menutup pintu air SUTET dan mengunci seluruh sistem...\n")
                server.data_bank.set_holding_registers(0, [0, 0, 200]) # Q=0, Gate=0, Temp=200
                continue

            print(f"[MODBUS RUNNING] Q: {debit} m³/s | Gate: {gate_opening}% Buka | Q_eff: {effective_debit:.1f} m³/s | Suhu: {int_temp}°C")

        except Exception as e:
            print(f"Error in physics simulation: {e}")
            
        time.sleep(1.0) # 1 Hertz loop

# Run the physics loop in a background daemon thread
physics_thread = threading.Thread(target=physical_simulation_loop, daemon=True)

try:
    # Start server and thread
    server.start()
    physics_thread.start()
    print("Modbus Server is online! Press Ctrl+C to terminate.")
    
    while True:
        time.sleep(1)
        
except KeyboardInterrupt:
    print("\nShutting down Modbus TCP server.")
    server.stop()
    print("Server offline. Goodbye!")
