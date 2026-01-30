import { UUID, BaseEntity } from './shared';

/**
 * AssetEvidence represents linked history and evidence for an asset.
 * This is a placeholder interface for future asset intelligence features.
 * 
 * TODO: Implement full evidence tracking system
 * TODO: Link to asset_evidence table schema
 * TODO: Add evidence types (image, audio, document, etc.)
 */
export interface AssetEvidence extends BaseEntity {
  asset_id: UUID;
  evidence_type: 'image' | 'audio' | 'document' | 'note' | 'other';
  attachment_id?: UUID;
  description?: string;
  captured_at?: string;
  metadata?: Record<string, unknown>;
}

/**
 * AssetConditionSignal represents AI-generated signals from images or audio
 * that drive the asset's condition_score.
 * 
 * Signals from images: Rust, Leak, Damage, etc.
 * Signals from audio: Bearing noise, Unusual sounds, etc.
 * 
 * TODO: Implement signal detection and processing
 * TODO: Define signal types and severity levels
 * TODO: Link signals to condition_score calculation
 */
export interface AssetConditionSignal extends BaseEntity {
  asset_id: UUID;
  evidence_id?: UUID;
  signal_type: 'rust' | 'leak' | 'damage' | 'bearing_noise' | 'unusual_sound' | 'wear' | 'other';
  source: 'image' | 'audio' | 'manual';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-100
  description?: string;
  detected_at: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating new asset evidence.
 * TODO: Implement evidence creation logic
 */
export interface AssetEvidenceCreateInput {
  org_id: UUID;
  asset_id: UUID;
  evidence_type: AssetEvidence['evidence_type'];
  attachment_id?: UUID;
  description?: string;
  captured_at?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating new condition signals.
 * TODO: Implement signal creation logic
 */
export interface AssetConditionSignalCreateInput {
  org_id: UUID;
  asset_id: UUID;
  evidence_id?: UUID;
  signal_type: AssetConditionSignal['signal_type'];
  source: AssetConditionSignal['source'];
  severity: AssetConditionSignal['severity'];
  confidence: number;
  description?: string;
  detected_at: string;
  metadata?: Record<string, unknown>;
}
