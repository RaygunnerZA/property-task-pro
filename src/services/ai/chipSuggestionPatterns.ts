/**
 * Rule-based extraction patterns for chip suggestions
 * These patterns power the deterministic NLP layer of the suggestion engine
 */

import { ExtractionPatterns } from '@/types/chip-suggestions';

// Re-export consolidated fuzzy utilities so existing imports keep working
export { levenshteinDistance, isFuzzyMatch, extractWords } from './fuzzyMatch';

export const extractionPatterns: ExtractionPatterns = {
  // Urgency detection keywords
  urgencyKeywords: [
    'urgent', 'asap', 'emergency', 'leak', 'broken', 'danger', 'risk',
    'immediately', 'critical', 'flooding', 'fire', 'safety', 'hazard',
    'burst', 'collapse', 'fail', 'failed', 'failure'
  ],

  // Low priority detection keywords
  lowPriorityKeywords: [
    'paint', 'tidy', 'clean', 'check', 'minor', 'routine', 'cosmetic',
    'touch-up', 'touchup', 'polish', 'dust', 'organize', 'arrange',
    'when you can', 'no rush', 'sometime', 'eventually'
  ],

  // Compliance mode triggers
  complianceKeywords: [
    'certificate', 'inspection', 'legal', 'fire safety', 'gas', 'electrical',
    'compliance', 'regulation', 'permit', 'license', 'audit', 'assessment',
    'epc', 'energy performance', 'safety check', 'annual', 'mandatory',
    'statutory', 'hmo', 'landlord', 'tenant safety'
  ],

  // Asset-to-space mapping for intelligent space suggestions
  assetToSpaceMap: {
    'boiler': ['Boiler Room', 'Utility Room', 'Basement'],
    'radiator': ['Living Room', 'Bedroom', 'Hallway'],
    'sink': ['Kitchen', 'Bathroom', 'Utility Room'],
    'toilet': ['Bathroom', 'WC', 'Ensuite'],
    'shower': ['Bathroom', 'Ensuite'],
    'bath': ['Bathroom', 'Ensuite'],
    'oven': ['Kitchen'],
    'cooker': ['Kitchen'],
    'fridge': ['Kitchen'],
    'washing machine': ['Utility Room', 'Kitchen'],
    'dryer': ['Utility Room'],
    'window': ['Living Room', 'Bedroom', 'Kitchen'],
    'door': ['Hallway', 'Entrance', 'Living Room'],
    'roof': ['Exterior', 'Loft'],
    'gutter': ['Exterior'],
    'garden': ['Garden', 'Exterior'],
    'fence': ['Garden', 'Exterior'],
    'carpet': ['Living Room', 'Bedroom', 'Hallway'],
    'floor': ['Living Room', 'Kitchen', 'Hallway'],
    'ceiling': ['Living Room', 'Bedroom', 'Kitchen'],
    'light': ['Living Room', 'Bedroom', 'Kitchen', 'Hallway'],
    'socket': ['Living Room', 'Bedroom', 'Kitchen'],
    'switch': ['Hallway', 'Living Room', 'Bedroom']
  },

  // Date detection patterns
  datePatterns: [
    /\b(today)\b/i,
    /\b(tomorrow)\b/i,
    /\bnext\s+week\s+(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b(?:before|by)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b(next week)\b/i,
    /\b(this week)\b/i,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b(\d{1,2}(?:st|nd|rd|th)?)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i,
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}(?:st|nd|rd|th)?)\b/i
  ]
};

// NOTE: levenshteinDistance, isFuzzyMatch, and extractWords are now
// consolidated in ./fuzzyMatch.ts and re-exported at the top of this file.
