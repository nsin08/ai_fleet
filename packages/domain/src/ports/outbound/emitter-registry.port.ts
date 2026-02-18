import type { EmitterHeartbeat } from '../../entities/fleet-state.js';

export interface RegisteredEmitter {
  vehicleId: string;
  vehicleRegNo: string;
  emitterInstanceId: string;
  registeredAt: Date;
}

export interface EmitterRegistryPort {
  registerEmitter(
    vehicleId: string,
    vehicleRegNo: string,
    instanceId: string,
  ): Promise<RegisteredEmitter>;
  deregisterEmitter(vehicleId: string): Promise<void>;
  listEmitters(): Promise<RegisteredEmitter[]>;
  upsertHeartbeat(payload: EmitterHeartbeat): Promise<void>;
  getHeartbeat(vehicleId: string): Promise<EmitterHeartbeat | null>;
}
