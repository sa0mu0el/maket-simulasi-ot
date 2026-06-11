export interface PltaState {
  isGateOpen: boolean;
  gateOpening: number; // 0 to 100% open
  waterDebit: number; // in m³/s, e.g., 0 to 100
  turbineEfficiency: number; // %
  loadRequest: number; // in MW, power demand from grid
  soundEnabled: boolean;
  activeHotspotId: string | null;
  activeTab: 'simulation' | 'education' | 'quiz';
  quizScore: number;
  quizSubmitted: boolean;
  selectedAnswers: Record<number, number>;
  
  // Generator Temp and Explosion physical systems
  generatorTemp: number; // in °C (target <= 200°C)
  isExploded: boolean;
  
  // Modbus TCP connection state for real hardware sync
  modbusEnabled?: boolean;
  modbusIp?: string;
  modbusPort?: number;
  modbusDebitRegister?: number; // Register index for water discharge (Q)
  modbusGateRegister?: number;  // Register index for gate status (0=close, 1=open)
  modbusTempRegister?: number;  // Register index for generator temperature
  modbusStatus?: 'disconnected' | 'connecting' | 'connected' | 'error';
  modbusError?: string;
}

export interface Hotspot {
  id: string;
  name: string;
  titleIndonesian: string;
  description: string;
  coordinate: { x: number; y: number }; // relative coordinate in logical 1000x550 space
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}
