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

  // Activity-to-space mapping: verbs / nouns that imply a space context.
  // Keys are lowercase activity keywords; values are ordered candidate space names.
  // The engine matches these against the property's EXISTING spaces first.
  activityToSpaceMap: {
    // Plumbing
    'plumbing':        ['Bathroom', 'Kitchen', 'Utility Room', 'Scullery', 'Wet Room'],
    'plumb':           ['Bathroom', 'Kitchen', 'Utility Room', 'Scullery'],
    'draining':        ['Bathroom', 'Kitchen', 'Scullery', 'Utility Room'],
    'blocked drain':   ['Bathroom', 'Kitchen', 'Scullery'],
    'shower pressure': ['Bathroom', 'Ensuite', 'Wet Room'],
    'hot water':       ['Bathroom', 'Utility Room', 'Boiler Room', 'Kitchen'],
    'water pressure':  ['Bathroom', 'Utility Room', 'Boiler Room'],
    'leaking':         ['Bathroom', 'Kitchen', 'Utility Room', 'Boiler Room'],
    'flooding':        ['Bathroom', 'Kitchen', 'Basement', 'Utility Room'],
    // Electrical
    'electrical':      ['Living Room', 'Kitchen', 'Bedroom', 'Hallway'],
    'wiring':          ['Living Room', 'Kitchen', 'Bedroom', 'Office'],
    'fuse':            ['Utility Room', 'Hallway', 'Boiler Room', 'Basement'],
    'circuit':         ['Utility Room', 'Hallway', 'Living Room'],
    'socket':          ['Living Room', 'Kitchen', 'Bedroom', 'Office'],
    // Heating / cooling
    'heating':         ['Boiler Room', 'Utility Room', 'Living Room', 'Bedroom'],
    'boiler':          ['Boiler Room', 'Utility Room', 'Kitchen'],
    'air conditioning':['Living Room', 'Bedroom', 'Office'],
    'radiator':        ['Living Room', 'Bedroom', 'Hallway'],
    // Cooking / kitchen
    'cooking':         ['Kitchen'],
    'dinner':          ['Kitchen', 'Dining Room'],
    'dinner party':    ['Kitchen', 'Dining Room', 'Living Room'],
    'prep':            ['Kitchen', 'Scullery', 'Pantry'],
    'catering':        ['Kitchen', 'Dining Room'],
    'breakfast':       ['Kitchen', 'Dining Room'],
    // Garden / outdoor
    'mowing':          ['Garden', 'Lawn', 'Back Garden', 'Front Garden'],
    'mow':             ['Garden', 'Lawn'],
    'lawn':            ['Garden', 'Lawn', 'Back Garden'],
    'hedging':         ['Garden', 'Exterior'],
    'hedge':           ['Garden'],
    'pruning':         ['Garden', 'Exterior'],
    'landscaping':     ['Garden', 'Exterior', 'Grounds'],
    'patio':           ['Patio', 'Garden', 'Terrace'],
    'decking':         ['Deck', 'Patio', 'Garden'],
    // Cleaning
    'deep clean':      ['Kitchen', 'Bathroom', 'Living Room'],
    'carpet clean':    ['Living Room', 'Bedroom', 'Hallway'],
    'window clean':    ['Living Room', 'Bedroom', 'Exterior'],
    // Arrival / transport
    'airport':         ['Entrance', 'Driveway', 'Lobby', 'Reception'],
    'fetch':           ['Entrance', 'Driveway', 'Reception'],
    'pick up':         ['Entrance', 'Driveway', 'Lobby'],
    'drop off':        ['Entrance', 'Driveway', 'Lobby'],
    'collect':         ['Entrance', 'Driveway', 'Reception'],
    'station':         ['Entrance', 'Driveway', 'Lobby'],
    // Storage / utility
    'storage':         ['Garage', 'Basement', 'Utility Room', 'Shed', 'Loft', 'Attic'],
    'laundry':         ['Utility Room', 'Laundry Room', 'Kitchen'],
    'washing':         ['Utility Room', 'Laundry Room', 'Kitchen'],
    // Security / entry
    'lock':            ['Entrance', 'Hallway', 'Front Door', 'Back Door'],
    'door entry':      ['Entrance', 'Hallway', 'Lobby'],
    'alarm':           ['Hallway', 'Entrance', 'Control Room'],
    // Pool / gym
    'pool':            ['Swimming Pool', 'Pool Area', 'Leisure'],
    'swimming':        ['Swimming Pool', 'Pool Area'],
    'gym':             ['Gym', 'Fitness Room', 'Leisure'],
    'hot tub':         ['Pool Area', 'Garden', 'Terrace'],
  } as Record<string, string[]>,

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
