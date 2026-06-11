import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import net from "net";
import Modbus from "jsmodbus";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to read Modbus data
  app.get("/api/modbus-data", async (req, res) => {
    const ip = (req.query.ip as string) || "192.168.122.151";
    const port = parseInt(req.query.port as string) || 1502;
    
    // Parse specified register indexes with standard defaults
    const debitReg = typeof req.query.debitReg === 'string' ? parseInt(req.query.debitReg) : 0;
    const gateReg = typeof req.query.gateReg === 'string' ? parseInt(req.query.gateReg) : 1;
    const tempReg = typeof req.query.tempReg === 'string' ? parseInt(req.query.tempReg) : 2;

    const minReg = Math.min(debitReg, gateReg, tempReg);
    const maxReg = Math.max(debitReg, gateReg, tempReg);
    const count = maxReg - minReg + 1;

    console.log(`Connecting to Modbus client at ${ip}:${port} to read registers from ${minReg} (count: ${count})...`);

    const socket = new net.Socket();
    const client = new (Modbus.client.TCP as any)(socket);
    let resolved = false;

    // Timeout-safe socket connection wrap
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        res.status(504).json({
          success: false,
          error: "Modbus connection timed out (IP is private or offline)",
          code: "ETIMEDOUT",
          ip,
          port,
          debitReg,
          gateReg,
          tempReg
        });
      }
    }, 3000); // 3 seconds timeout

    socket.on("connect", () => {
      client
        .readHoldingRegisters(minReg, count)
        .then((resp: any) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            const values = resp.response._body.valuesAsArray;
            
            // Map values back to requested registers
            const debitValue = values[debitReg - minReg];
            const gateValue = values[gateReg - minReg];
            const tempValue = values[tempReg - minReg];
            
            socket.end();
            res.json({
              success: true,
              debitValue: typeof debitValue === 'number' ? debitValue : 0,
              gateValue: typeof gateValue === 'number' ? gateValue : 0,
              tempValue: typeof tempValue === 'number' ? tempValue : 0,
              values: values,
              ip,
              port,
              timestamp: new Date().toISOString()
            });
          }
        })
        .catch((err: any) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            socket.end();
            res.status(500).json({
              success: false,
              error: err.message || "Failed to read Modbus registers",
              code: err.code || "EREADFAILED",
              ip,
              port
            });
          }
        });
    });

    socket.on("error", (err: any) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        socket.destroy();
        res.status(502).json({
          success: false,
          error: `Modbus socket error: ${err.message}`,
          code: err.code || "ESOCKET",
          ip,
          port
        });
      }
    });

    try {
      socket.connect({ host: ip, port: port });
    } catch (err: any) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        socket.destroy();
        res.status(500).json({
          success: false,
          error: `Modbus connection initialization failed: ${err.message}`,
          code: "EINIT",
          ip,
          port
        });
      }
    }
  });

  // API Route to write Modbus register data
  app.post("/api/modbus-write", async (req, res) => {
    const { ip, port, register, value } = req.body;
    
    if (typeof register !== "number" || typeof value !== "number") {
      res.status(400).json({ success: false, error: "Missing register or value inside payload" });
      return;
    }

    const targetIp = ip || "192.168.122.151";
    const targetPort = parseInt(port) || 1502;

    console.log(`Command triggered: Writing value ${value} to PLC register ${register} at ${targetIp}:${targetPort}...`);

    const socket = new net.Socket();
    const client = new (Modbus.client.TCP as any)(socket);
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        res.status(504).json({
          success: false,
          error: "Modbus connection timed out during write operation"
        });
      }
    }, 2500);

    socket.on("connect", () => {
      client
        .writeSingleRegister(register, value)
        .then(() => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            socket.end();
            res.json({
              success: true,
              register,
              value,
              ip: targetIp,
              port: targetPort,
              timestamp: new Date().toISOString()
            });
          }
        })
        .catch((err: any) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            socket.end();
            res.status(500).json({
              success: false,
              error: err.message || "Failed to write register",
              ip: targetIp,
              port: targetPort
            });
          }
        });
    });

    socket.on("error", (err: any) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        socket.destroy();
        res.status(502).json({
          success: false,
          error: `Modbus socket error during write: ${err.message}`,
          ip: targetIp,
          port: targetPort
        });
      }
    });

    try {
      socket.connect({ host: targetIp, port: targetPort });
    } catch (err: any) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        socket.destroy();
        res.status(500).json({
          success: false,
          error: `Socket write initialization failed: ${err.message}`,
          ip: targetIp,
          port: targetPort
        });
      }
    }
  });

  // Serve static assets in production or use Vite dev middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
