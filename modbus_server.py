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
import socket

# Dependency Check for pyModbusTCP
try:
    from pyModbusTCP.server import ModbusServer
except ImportError:
    print("\n" + "=" * 65)
    print("❌ ERROR: Modul 'pyModbusTCP' belum terinstall di komputer Debian Anda!")
    print("=" * 65)
    print("Untuk menginstallnya di OS modern (seperti Debian 12), gunakan salah satu cara:")
    print("\n👉 Cara 1: Menggunakan APT Debian (Sangat Direkomendasikan)")
    print("    sudo apt update && sudo apt install python3-pymodbustcp -y")
    print("\n👉 Cara 2: Menggunakan PIP dengan flag bypass")
    print("    pip3 install pyModbusTCP --break-system-packages")
    print("\n👉 Cara 3: Menggunakan Virtual Environment (VENV)")
    print("    sudo apt update && sudo apt install python3-venv python3-full -y")
    print("    python3 -m venv venv")
    print("    source venv/bin/activate")
    print("    pip install pyModbusTCP")
    print("=" * 65 + "\n")
    sys.exit(1)

# Configuration
SERVER_HOST = "0.0.0.0"       # Listen on all local IP addresses (like your Modbus server)
SERVER_PORT = 502             # Public external Port for HMI client connections (requires sudo/root)
INTERNAL_PORT = 15020         # Internal loopback port for the real pyModbusTCP server backend

# Initialize the real Modbus TCP server (bound only to localhost internally)
server = ModbusServer(host="127.0.0.1", port=INTERNAL_PORT, no_block=True)

print("=" * 60)
print(f"Starting PLTA Modbus TCP Server Backend on localhost:{INTERNAL_PORT}")
print("Holding Register Mapping:")
print("  - [40001 / Address 0] : Debit Air (Q) (0 - 100 m³/s)")
print("  - [40002 / Address 1] : Gate / Pintu Air (0% - 100% Buka)")
print("  - [40003 / Address 2] : Suhu Generator (°C) (0 - 250 °C)")
print("=" * 60)

# Seed Initial Modbus Bank values
# Address 0: Q = 75 m3/s, Address 1: Gate = 100% (Open), Address 2: Temp = 45 °C
server.data_bank.set_holding_registers(0, [75, 100, 45])

def proxy_client_handler(client_sock, client_addr):
    """
    Handles TCP clients connecting to SERVER_PORT (1502).
    Intercepts Function/Command Code 43 (0x2B) to return simulated Schneider PLC Device ID.
    Proxies all other standard Modbus requests to the local pyModbusTCP server backend.
    """
    internal_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        internal_sock.connect(("127.0.0.1", INTERNAL_PORT))
    except Exception as e:
        print(f"❌ Proxy Error: Tidak dapat terhubung ke backend server Modbus internal: {e}")
        client_sock.close()
        return

    # Set reasonable socket timeouts
    client_sock.settimeout(15.0)
    internal_sock.settimeout(15.0)

    try:
        while True:
            # 1. Read standard MBAP Header (first 6 bytes)
            header = b""
            while len(header) < 6:
                chunk = client_sock.recv(6 - len(header))
                if not chunk:
                    return  # Client connection lost
                header += chunk

            # Extract transaction ID, protocol ID, and remaining payload length
            tx_id = header[0:2]
            proto_id = header[2:4]
            rem_len = int.from_bytes(header[4:6], byteorder='big')

            if rem_len <= 0 or rem_len > 300:
                break  # Safe threshold on packet size

            # 2. Read the remaining 'rem_len' bytes (includes Unit ID, FC, Data)
            payload = b""
            while len(payload) < rem_len:
                chunk = client_sock.recv(rem_len - len(payload))
                if not chunk:
                    return  # Client connection lost
                payload += chunk

            unit_id = payload[0:1]
            func_code = payload[1]

            # 3. INTERCEPT FUNCTION CODE 43 (0x2B): Read Device Identification
            if func_code == 0x2b:
                print(f"\n🕵️‍♂️ [OT SECURITY ALERT - RECONNAISSANCE DETECTED]:")
                print(f"   🚩 IP Source  : {client_addr[0]}:{client_addr[1]}")
                print(f"   🚩 Function   : Function Code 43 (0x2B) - Read Device Identification")
                print(f"   🚩 Tool/Scan  : Aktivitas scanning reconnaissance (Nmap / modbus-discover)!")
                
                mei_type = payload[2] if len(payload) > 2 else 0x0E
                read_device_code = payload[3] if len(payload) > 3 else 0x01
                conformance = 0x81  # Basic Device Identification (stream & individual access support)
                more_follows = 0x00
                next_obj_id = 0x00
                num_items = 4       # Return VendorName, ProductCode, Version, and Model Name

                # Construct Type-Length-Value (TLV) Objects for PLC Identity
                # Object 0x00: Vendor Name
                obj0 = b"\x00" + len("Schneider Electric").to_bytes(1, "big") + b"Schneider Electric"
                # Object 0x01: Product Code
                obj1 = b"\x01" + len("TM221CE16R").to_bytes(1, "big") + b"TM221CE16R"
                # Object 0x02: Major/Minor Revision
                obj2 = b"\x02" + len("V1.4.02").to_bytes(1, "big") + b"V1.4.02"
                # Object 0x04: Product Name / Model
                obj4 = b"\x04" + len("Modicon M221").to_bytes(1, "big") + b"Modicon M221"

                # Construct Response PDU
                pdu_resp = bytes([0x2b, mei_type, read_device_code, conformance, more_follows, next_obj_id, num_items])
                pdu_resp += obj0 + obj1 + obj2 + obj4

                # Build MBAP header (response length = 1 byte for unit ID + len(pdu_resp))
                resp_len_bytes = (1 + len(pdu_resp)).to_bytes(2, "big")
                mbap_resp = tx_id + proto_id + resp_len_bytes + unit_id

                full_resp = mbap_resp + pdu_resp
                print(f"   🛡️ Response   : Mengirimkan identitas PLC palsu/emulasi:")
                print(f"                   [Vendor] Schneider Electric | [P_Code] TM221CE16R | [FW] V1.4.02 | [Model] Modicon M221")
                print(f"   🛡️ OT Audit   : Palo Alto Networks PA-VM Virtual Wire dapat melacak scan Function 43 ini!\n")
                
                client_sock.sendall(full_resp)
            else:
                # 4. Standard Request: Proxy exactly to the local pyModbusTCP server backend
                full_req = header + payload
                internal_sock.sendall(full_req)

                # Process local response header (first 6 bytes)
                resp_header = b""
                while len(resp_header) < 6:
                    chunk = internal_sock.recv(6 - len(resp_header))
                    if not chunk:
                        return
                    resp_header += chunk

                resp_rem_len = int.from_bytes(resp_header[4:6], byteorder='big')

                # Process local response payload
                resp_payload = b""
                while len(resp_payload) < resp_rem_len:
                    chunk = internal_sock.recv(resp_rem_len - len(resp_payload))
                    if not chunk:
                        return
                    resp_payload += chunk

                # Forward standard Modbus holding register answers back to the client
                client_sock.sendall(resp_header + resp_payload)

    except Exception:
        pass
    finally:
        client_sock.close()
        internal_sock.close()

def run_proxy_listener():
    """
    Main proxy TCP server socket loop bound to SERVER_PORT (1502).
    Spawns processing worker thread for each client connection.
    """
    proxy_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    proxy_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        proxy_sock.bind((SERVER_HOST, SERVER_PORT))
        proxy_sock.listen(25)
    except Exception as e:
        print(f"❌ Proxy socket error: Tidak dapat melakukan bind pada {SERVER_HOST}:{SERVER_PORT}: {e}")
        sys.exit(1)

    while True:
        try:
            client_sock, client_addr = proxy_sock.accept()
            thr = threading.Thread(target=proxy_client_handler, args=(client_sock, client_addr), daemon=True)
            thr.start()
        except Exception:
            time.sleep(0.1)


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
    # Start the local pyModbusTCP server backend
    server.start()
    
    # Start the physical simulator loop
    physics_thread.start()

    # Start the front-facing Proxy server that intercepts 0x2B and proxies everything else
    proxy_thread = threading.Thread(target=run_proxy_listener, daemon=True)
    proxy_thread.start()
    
    print("=" * 65)
    print("❇️ Modbus Server & OT Security Emulator is ONLINE!")
    print(f"   - External IP Port : {SERVER_HOST}:{SERVER_PORT} (Public-facing proxy)")
    print(f"   - Internal IP Port : 127.0.0.1:{INTERNAL_PORT} (Local Modbus registers)")
    print("   - Active features  : Coils, Holdings, FC43 Read Device ID Intercept")
    print("=" * 65)
    print("Press Ctrl+C to terminate.")
    
    while True:
        time.sleep(1)
        
except KeyboardInterrupt:
    print("\nShutting down Modbus TCP server.")
    server.stop()
    print("Server offline. Goodbye!")
