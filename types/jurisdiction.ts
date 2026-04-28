export type LegalSystem =
  | 'common_law'
  | 'civil_law'
  | 'mixed'
  | 'religious_law'
  | 'customary_law'
  | 'unknown';

export interface JurisdictionParent {
  slug: string;
  name: string;
}

export interface Jurisdiction {
  slug: string;
  name: string;
  code: string;
  legal_system: LegalSystem;
  parent: JurisdictionParent | null;
}

export interface JurisdictionsResponse {
  status: 'success' | 'error';
  message: string;
  data: Jurisdiction[];
}

export type JurisdictionChoice =
  | { mode: 'auto' }
  | { mode: 'override'; slug: string }
  | { mode: 'none' };
