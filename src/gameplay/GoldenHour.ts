import { config, type Triage } from '../config';

export function triageSeconds(triage: Triage, override?: number): number {
  if (override && override > 0) return override;
  return config.golden[triage];
}

export function triageRank(triage: Triage): number {
  if (triage === 'urgent') return 0;
  if (triage === 'priority') return 1;
  return 2;
}
