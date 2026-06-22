export interface TargetArc {
  shape: 'build' | 'steady' | 'peak_early' | 'peak_late' | 'pulse';
  peakPositionPct: number;
  vocalGender: string;
  themesIncluded: string[];
  themesExcluded: string[];
  targetMarkets: string[];
  languages: string[];
  targetDurationSec: number;
  brandProfile: string;
  targetEnergy: number;
  targetValence: number;
}

export interface LineScore {
  idx: number;
  intensity: number; // 0..1
  valence: number;   // -1..1
  themeFit: number;  // 0..1
  isMoneyCandidate: boolean;
}

export interface SafetyVerdict {
  idx: number;
  category: string;
  severity: 'low' | 'med' | 'high';
  evidence: string;
  translation: string;
  timestampMs: number;
}
