export interface Driver {
  readonly id: string;
  readonly name: string;
  readonly licenseId: string;
  readonly baseSafetyScore: number;   // 0–100
  readonly currentSafetyScore: number; // 0–100
  readonly phone?: string;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
