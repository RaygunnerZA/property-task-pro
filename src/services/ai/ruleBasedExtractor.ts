/**
 * Rule-Based Chip Extraction Engine
 * Deterministic NLP layer for intelligent chip suggestions
 */

import { 
  SuggestedChip, 
  GhostCategory, 
  ChipSuggestionContext,
  ChipSuggestionResult,
  PriorityValue
} from '@/types/chip-suggestions';
import { 
  extractionPatterns, 
  isFuzzyMatch, 
  extractWords 
} from './chipSuggestionPatterns';

interface AvailableEntities {
  spaces: Array<{ id: string; name: string; property_id: string }>;
  members: Array<{ id: string; user_id: string; display_name: string }>;
  teams: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}

/**
 * Main rule-based extraction function
 */
export function extractChipsFromText(
  context: ChipSuggestionContext,
  entities: AvailableEntities
): ChipSuggestionResult {
  const chips: SuggestedChip[] = [];
  const ghostCategories: GhostCategory[] = [];
  let complianceMode = false;

  // Combine description + image OCR + detected labels/objects for extraction
  const labelParts = (context.detectedLabels || []).concat(
    (context.detectedObjects || []).map((o) => o.label)
  );
  const combinedText = [
    context.description,
    context.imageOcrText,
    ...labelParts,
  ]
    .filter(Boolean)
    .join(" ");
  const text = combinedText.toLowerCase();
  const words = extractWords(combinedText);
  
  // 1. Priority detection
  const priorityChip = detectPriority(text);
  if (priorityChip) {
    chips.push(priorityChip);
  }
  
  // 2. Compliance mode detection
  complianceMode = detectComplianceMode(text);
  if (complianceMode) {
    chips.push({
      id: `compliance-${Date.now()}`,
      type: 'compliance',
      value: 'compliance',
      label: 'Compliance Task',
      score: 0.8,
      source: 'rule'
    });
    
    // Ghost group for compliance
    ghostCategories.push({
      id: `ghost-compliance-${Date.now()}`,
      name: 'Compliance Tasks',
      reason: 'compliance',
      score: 0.7
    });
  }
  
  // 3. Space detection
  const spaceChips = detectSpaces(text, words, entities.spaces, context.propertyId);
  chips.push(...spaceChips);
  
  // Ghost groups for detected spaces
  spaceChips.forEach(chip => {
    if (chip.score >= 0.6) {
      ghostCategories.push({
        id: `ghost-space-${chip.value}`,
        name: `${chip.label} Tasks`,
        reason: 'space',
        score: chip.score * 0.8
      });
    }
  });
  
  // 3b. Asset detection (using assetToSpaceMap keys as known assets)
  const assetChips = detectAssets(text, words);
  chips.push(...assetChips);
  
  // 4. Person detection — pass combinedText (original casing) for proper-noun detection
  const personChips = detectPersons(combinedText, words, entities.members);
  chips.push(...personChips);
  
  // Ghost groups for frequent assignees
  personChips.forEach(chip => {
    if (chip.score >= 0.7) {
      ghostCategories.push({
        id: `ghost-person-${chip.value}`,
        name: `Tasks for ${chip.label}`,
        reason: 'assignee',
        score: chip.score * 0.7
      });
    }
  });
  
  // 5. Team detection
  const teamChips = detectTeams(text, words, entities.teams);
  chips.push(...teamChips);
  
  // 6. Date detection
  const dateChip = detectDate(text);
  if (dateChip) {
    chips.push(dateChip);
  }
  
  // 7. Urgency-based ghost group
  if (priorityChip?.value === 'urgent') {
    ghostCategories.push({
      id: `ghost-urgent-${Date.now()}`,
      name: 'Urgent Repairs',
      reason: 'urgency',
      score: 0.75
    });
  }
  
  // Sort chips by score
  chips.sort((a, b) => b.score - a.score);
  ghostCategories.sort((a, b) => b.score - a.score);
  
  return {
    chips: chips.filter(c => c.score >= 0.5),
    ghostCategories: ghostCategories.filter(c => c.score >= 0.5),
    complianceMode
  };
}

/**
 * Detect priority level from text
 */
function detectPriority(text: string): SuggestedChip | null {
  const { urgencyKeywords, lowPriorityKeywords } = extractionPatterns;
  
  // Check for urgent keywords
  for (const keyword of urgencyKeywords) {
    if (text.includes(keyword)) {
      return {
        id: `priority-urgent-${Date.now()}`,
        type: 'priority',
        value: 'urgent',
        label: 'Urgent',
        score: 0.9,
        source: 'rule',
        metadata: { matchedKeyword: keyword }
      };
    }
  }
  
  // Check for high priority indicators
  if (text.includes('important') || text.includes('priority') || text.includes('soon')) {
    return {
      id: `priority-high-${Date.now()}`,
      type: 'priority',
      value: 'high',
      label: 'High Priority',
      score: 0.7,
      source: 'rule'
    };
  }
  
  // Check for low priority keywords
  for (const keyword of lowPriorityKeywords) {
    if (text.includes(keyword)) {
      return {
        id: `priority-low-${Date.now()}`,
        type: 'priority',
        value: 'low',
        label: 'Low Priority',
        score: 0.7,
        source: 'rule',
        metadata: { matchedKeyword: keyword }
      };
    }
  }
  
  return null;
}

const complianceKeywordsLower = extractionPatterns.complianceKeywords.map(k => k.toLowerCase());

function detectComplianceMode(text: string): boolean {
  return complianceKeywordsLower.some(keyword => text.includes(keyword));
}

/**
 * Common space/location keywords that indicate a space name.
 * Includes both residential and commercial venue terms.
 */
const spaceKeywords = [
  // Residential
  'room', 'kitchen', 'bathroom', 'bedroom', 'living', 'garden', 'garage', 'office',
  'hall', 'hallway', 'entrance', 'cottage', 'house', 'flat', 'apartment', 'unit',
  'basement', 'attic', 'loft', 'cellar', 'shed', 'outbuilding', 'annex', 'studio',
  'ensuite', 'utility', 'pantry', 'laundry', 'conservatory', 'patio', 'deck',
  'balcony', 'terrace', 'yard', 'driveway', 'parking', 'lobby', 'foyer', 'landing',
  // Commercial / venue
  'alley', 'bar', 'cafe', 'restaurant', 'shop', 'store', 'warehouse', 'depot',
  'gym', 'pool', 'court', 'pitch', 'arena', 'stadium', 'club', 'centre', 'center',
  'reception', 'showroom', 'workshop', 'factory', 'plant', 'site', 'yard',
  'hotel', 'pub', 'lounge', 'suite', 'floor', 'wing', 'block', 'building',
];

const spaceKeywordPatterns = spaceKeywords.map(keyword => {
  const k = keyword.toLowerCase();
  return {
    keyword: k,
    patterns: [
      new RegExp(`\\b\\w+\\s+${k}\\b`, 'i'),
      new RegExp(`\\b(the\\s+)?${k}\\b`, 'i'),
      new RegExp(`\\b${k}\\s+\\w+\\b`, 'i'),
    ],
  };
});

/**
 * Patterns that indicate a multi-word location phrase:
 * "at the bowling alley", "in the main office", "at the car park" etc.
 */
const AT_LOCATION_PATTERN = /\b(?:at|in|from)\s+the\s+([a-z][a-z\s]{2,30}?)(?:\s+(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next|last|by|before|on|at\b)|[,.!?]|$)/gi;

/**
 * Detect spaces from text using fuzzy matching
 * Also detects potential space names that don't match existing spaces (creates verb/ghost chips)
 */
function detectSpaces(
  text: string,
  words: string[],
  spaces: Array<{ id: string; name: string; property_id: string }>,
  propertyId?: string
): SuggestedChip[] {
  const chips: SuggestedChip[] = [];
  const matchedSpaces = new Set<string>();
  const filteredSpaces = propertyId 
    ? spaces.filter(s => s.property_id === propertyId)
    : spaces;
  
  // Direct space name matching
  for (const space of filteredSpaces) {
    const spaceName = space.name.toLowerCase();
    
    // Check for fuzzy match in text
    if (text.includes(spaceName) || words.some(w => isFuzzyMatch(w, spaceName))) {
      chips.push({
        id: `space-${space.id}`,
        type: 'space',
        value: space.id,
        label: space.name,
        score: 0.85,
        source: 'rule',
        resolvedEntityId: space.id,
        blockingRequired: false
      });
      matchedSpaces.add(spaceName);
    }
  }
  
  // Asset-to-space mapping
  for (const [asset, possibleSpaces] of Object.entries(extractionPatterns.assetToSpaceMap)) {
    if (text.includes(asset.toLowerCase())) {
      for (const spaceName of possibleSpaces) {
        const matchingSpace = filteredSpaces.find(s => 
          isFuzzyMatch(s.name.toLowerCase(), spaceName.toLowerCase())
        );
        
        if (matchingSpace && !chips.some(c => c.value === matchingSpace.id)) {
          chips.push({
            id: `space-asset-${matchingSpace.id}`,
            type: 'space',
            value: matchingSpace.id,
            label: matchingSpace.name,
            score: 0.65,
            source: 'rule',
            resolvedEntityId: matchingSpace.id,
            blockingRequired: false,
            metadata: { matchedAsset: asset }
          });
          matchedSpaces.add(matchingSpace.name.toLowerCase());
          break; // Only add first matching space
        }
      }
    }
  }
  
  // ── "at the [phrase]" / "in the [phrase]" multi-word location capture ─────
  // Catches things like "at the bowling alley", "in the main office"
  const atLocationRe = new RegExp(AT_LOCATION_PATTERN.source, 'gi');
  let atMatch: RegExpExecArray | null;
  while ((atMatch = atLocationRe.exec(text)) !== null) {
    const phrase = atMatch[1].trim();
    const phraseLower = phrase.toLowerCase();
    if (phrase.length < 3 || matchedSpaces.has(phraseLower)) continue;
    // Skip if it matches a date word
    if (/^(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next|last|week)/.test(phraseLower)) continue;
    const formattedName = phrase.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    chips.push({
      id: `space-ghost-phrase-${phraseLower.replace(/\s+/g, '-')}`,
      type: 'space',
      value: formattedName,
      label: formattedName,
      score: 0.65,
      source: 'rule',
      blockingRequired: true,
      metadata: { detectedAs: 'at_location_phrase' }
    });
    matchedSpaces.add(phraseLower);
  }

  for (const { keyword, patterns } of spaceKeywordPatterns) {
    if (text.includes(keyword) && !matchedSpaces.has(keyword)) {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          const spaceName = match[0].replace(/^the\s+/i, '').trim();
          const spaceNameLower = spaceName.toLowerCase();
          if (matchedSpaces.has(spaceNameLower)) break;
          const formattedName = spaceName.split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
          chips.push({
            id: `space-ghost-${spaceNameLower.replace(/\s+/g, '-')}`,
            type: 'space',
            value: formattedName,
            label: formattedName,
            score: 0.55,
            source: 'rule',
            blockingRequired: true,
            metadata: { detectedAs: 'space_keyword' }
          });
          matchedSpaces.add(spaceNameLower);
          break;
        }
      }
    }
  }
  
  return chips;
}

/**
 * Detect assets from text using assetToSpaceMap keys
 * Creates ghost chips for assets that are mentioned but may not exist in the system
 */
function detectAssets(
  text: string,
  words: string[]
): SuggestedChip[] {
  const chips: SuggestedChip[] = [];
  const matchedAssets = new Set<string>();
  
  // Check for known asset keywords from assetToSpaceMap
  for (const asset of Object.keys(extractionPatterns.assetToSpaceMap)) {
    const assetLower = asset.toLowerCase();
    
    if (text.includes(assetLower) && !matchedAssets.has(assetLower)) {
      // Capitalize asset name properly
      const formattedName = asset.split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      
      // Create an asset ghost chip (needs to be added to assets)
      chips.push({
        id: `asset-ghost-${assetLower.replace(/\s+/g, '-')}-${Date.now()}`,
        type: 'asset',
        value: formattedName,
        label: formattedName,
        score: 0.6,
        source: 'rule',
        blockingRequired: true, // Requires resolution (add to assets)
        metadata: { detectedAs: 'known_asset_keyword' }
      });
      matchedAssets.add(assetLower);
    }
  }
  
  return chips;
}

// Words that are never person names
const NON_NAME_WORDS = new Set([
  'fix', 'check', 'clean', 'repair', 'install', 'replace', 'inspect', 'review',
  'update', 'remove', 'add', 'call', 'book', 'schedule', 'contact', 'order',
  'buy', 'get', 'test', 'paint', 'seal', 'drain', 'flush', 'reset',
  'the', 'this', 'that', 'and', 'for', 'not', 'but', 'from', 'with', 'into',
  'must', 'should', 'needs', 'will', 'can', 'may', 'please', 'urgent',
  'today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday', 'next', 'last', 'asap',
  'kitchen', 'bathroom', 'bedroom', 'living', 'garden', 'garage', 'office',
  'hall', 'entrance', 'cottage', 'house', 'flat', 'apartment', 'room',
  'boiler', 'toilet', 'shower', 'window', 'door', 'pipe', 'roof', 'floor',
  'wall', 'ceiling', 'stove', 'oven', 'fridge', 'sink', 'tap', 'lock',
  'new', 'old', 'broken', 'leaking', 'blocked', 'damaged', 'urgent',
  'high', 'low', 'medium', 'normal',
]);

// Subject-indicating verbs: "X must/should/needs to/will/has to [verb]"
const SUBJECT_PATTERNS = [
  /^([a-zA-Z]{3,})\s+(?:must|should|needs?\s+to|will|has\s+to|is\s+to|to)\b/i,
  /^([a-zA-Z]{3,})\s+(?:please|can|could)\b/i,
];

// Directed-name phrases: "call john", "assign to john", "ask john to", etc.
const DIRECTED_NAME_PATTERNS = [
  /\b(?:call|ask|tell|contact|message|email|assign(?:\s+to)?|tag|loop\s+in)\s+([a-zA-Z]{3,})\b/i,
  /\bfor\s+([a-zA-Z]{3,})\b/i,
];

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const WEEKDAY_ALIASES: Record<string, string> = {
  sun: "sunday",
  sunday: "sunday",
  mon: "monday",
  monday: "monday",
  tue: "tuesday",
  tues: "tuesday",
  tuesday: "tuesday",
  wed: "wednesday",
  wednesday: "wednesday",
  thu: "thursday",
  thur: "thursday",
  thurs: "thursday",
  thursday: "thursday",
  fri: "friday",
  friday: "friday",
  sat: "saturday",
  saturday: "saturday",
};

const WEEKDAY_TOKEN_PATTERN =
  "(?:sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat)";

const RELATIVE_NUMBER_PATTERN =
  "(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\\d+)";

/**
 * Detect persons from text using fuzzy matching against org members,
 * plus heuristic detection of potential person names (sentence subjects,
 * proper nouns) for unknown/unregistered people.
 *
 * @param originalText  The description with ORIGINAL casing (not lowercased).
 * @param words         Tokens from the description (original casing).
 * @param members       Org member list.
 */
function detectPersons(
  originalText: string,
  words: string[],
  members: Array<{ id: string; user_id: string; display_name: string }>
): SuggestedChip[] {
  const chips: SuggestedChip[] = [];
  const matchedNames = new Set<string>(); // tracks already-matched lowercased names

  // ── 1. Match against existing org members (case-insensitive) ──────────────
  for (const member of members) {
    const nameParts = member.display_name.toLowerCase().split(/\s+/);
    for (const part of nameParts) {
      if (part.length > 2 && words.some(w => isFuzzyMatch(w.toLowerCase(), part))) {
        chips.push({
          id: `person-${member.user_id}`,
          type: 'person',
          value: member.user_id,
          label: member.display_name,
          score: 0.85,
          source: 'rule',
          resolvedEntityId: member.user_id,
          blockingRequired: false,
        });
        nameParts.forEach(p => matchedNames.add(p));
        break;
      }
    }
  }

  // ── 2. Detect sentence subject as potential person name ───────────────────
  // Handles both "Frank must fix …" and "frank must fix …" (lowercase too)
  const trimmed = originalText.trim();
  for (const pattern of SUBJECT_PATTERNS) {
    const m = trimmed.match(pattern);
    if (m) {
      const name = m[1];
      const nameLower = name.toLowerCase();
      if (!matchedNames.has(nameLower) && !NON_NAME_WORDS.has(nameLower)) {
        chips.push({
          id: `person-ghost-subject-${nameLower}`,
          type: 'person',
          value: name,
          label: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
          score: 0.7,
          source: 'rule',
          blockingRequired: true,
          metadata: { detectedAs: 'sentence_subject' },
        });
        matchedNames.add(nameLower);
      }
      break;
    }
  }

  // ── 3. Capitalized proper nouns (e.g. "Call Frank about …") ─────────────
  const properNounPattern = /\b([A-Z][a-z]{2,})\b/g;
  let m: RegExpExecArray | null;
  while ((m = properNounPattern.exec(originalText)) !== null) {
    const name = m[1];
    const nameLower = name.toLowerCase();
    if (matchedNames.has(nameLower)) continue;
    if (NON_NAME_WORDS.has(nameLower)) continue;
    chips.push({
      id: `person-ghost-${nameLower}`,
      type: 'person',
      value: name,
      label: name,
      score: 0.6,
      source: 'rule',
      blockingRequired: true,
      metadata: { detectedAs: 'proper_noun' },
    });
    matchedNames.add(nameLower);
  }

  // ── 4. Directed lowercase/common names (e.g. "call john", "assign to john")
  for (const pattern of DIRECTED_NAME_PATTERNS) {
    const directedMatch = originalText.match(pattern);
    if (!directedMatch) continue;
    const name = directedMatch[1];
    const nameLower = name.toLowerCase();
    if (matchedNames.has(nameLower) || NON_NAME_WORDS.has(nameLower)) continue;
    chips.push({
      id: `person-ghost-directed-${nameLower}`,
      type: "person",
      value: name,
      label: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
      score: 0.68,
      source: "rule",
      blockingRequired: true,
      metadata: { detectedAs: "directed_name_phrase" },
    });
    matchedNames.add(nameLower);
  }

  return chips;
}

/**
 * Detect teams from text using fuzzy matching
 */
function detectTeams(
  text: string,
  words: string[],
  teams: Array<{ id: string; name: string }>
): SuggestedChip[] {
  const chips: SuggestedChip[] = [];
  
  for (const team of teams) {
    const teamName = team.name.toLowerCase();
    const teamWords = teamName.split(' ').filter(w => w.length > 2);
    
    // Check if team name or any significant word matches
    if (text.includes(teamName) || teamWords.some(tw => words.some(w => isFuzzyMatch(w, tw)))) {
      chips.push({
        id: `team-${team.id}`,
        type: 'team',
        value: team.id,
        label: team.name,
        score: 0.7,
        source: 'rule'
      });
    }
  }
  
  return chips;
}

/**
 * Format a date as "DAY DD MONTH" (e.g., "TUES 10 FEBRUARY")
 */
function formatDateLabel(date: Date): string {
  const days = ['SUN', 'MON', 'TUES', 'WED', 'THURS', 'FRI', 'SAT'];
  const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 
                  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  
  const dayName = days[date.getDay()];
  const dayNum = date.getDate();
  const monthName = months[date.getMonth()];
  
  return `${dayName} ${dayNum} ${monthName}`;
}

/**
 * Calculate the next occurrence of a weekday
 * @param weekdayName - e.g., "monday", "tuesday"
 * @param skipCurrent - if true, always go to next week's occurrence
 */
function normalizeWeekdayToken(token: string): string | null {
  const normalized = token.trim().toLowerCase().replace(/[.,]/g, "");
  return WEEKDAY_ALIASES[normalized] ?? null;
}

function parseRelativeCount(token: string): number | null {
  const normalized = token.trim().toLowerCase();
  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }
  return NUMBER_WORDS[normalized] ?? null;
}

function getNextWeekday(weekdayName: string, skipCurrent: boolean = false): Date {
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = new Date();
  const normalizedWeekday = normalizeWeekdayToken(weekdayName);
  const targetDay = normalizedWeekday ? weekdays.indexOf(normalizedWeekday) : -1;
  
  if (targetDay === -1) return today;
  
  const currentDay = today.getDay();
  let daysToAdd = targetDay - currentDay;
  
  // If the day is today or in the past this week, go to next week
  if (daysToAdd <= 0 || skipCurrent) {
    daysToAdd += 7;
  }
  
  const result = new Date(today);
  result.setDate(today.getDate() + daysToAdd);
  return result;
}

const WEEKDAY_LIST = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const RE_NEXT_WEEK_WEEKDAY = new RegExp(`\\bnext\\s+week(?:\\s+on)?\\s+(${WEEKDAY_TOKEN_PATTERN})\\b`, "i");
const RE_NEXT_WEEKDAY = new RegExp(`\\bnext\\s+(${WEEKDAY_TOKEN_PATTERN})\\b`, "i");
const RE_BEFORE_WEEKDAY = new RegExp(`\\b(?:before|by)\\s+(${WEEKDAY_TOKEN_PATTERN})\\b`, "i");
const RE_RELATIVE_FROM_WEEKDAY = new RegExp(
  `\\b(?:in\\s+)?(${RELATIVE_NUMBER_PATTERN})\\s+weeks?\\s+(?:from\\s+)?(${WEEKDAY_TOKEN_PATTERN})\\b`,
  "i"
);
const RE_RELATIVE_TIME = new RegExp(
  `\\b(?:in\\s+)?(${RELATIVE_NUMBER_PATTERN})\\s+(day|days|week|weeks|month|months)\\b(?:\\s*(?:from\\s+today|from\\s+now|day'?s?\\s+time|time|from))?`,
  "i"
);
const RE_STANDALONE_WEEKDAY = new RegExp(`\\b(${WEEKDAY_TOKEN_PATTERN})\\b`, "i");

function detectDate(text: string): SuggestedChip | null {
  const { datePatterns } = extractionPatterns;

  const relativeFromWeekdayMatch = text.match(RE_RELATIVE_FROM_WEEKDAY);
  if (relativeFromWeekdayMatch) {
    const amount = parseRelativeCount(relativeFromWeekdayMatch[1]);
    const normalizedWeekday = normalizeWeekdayToken(relativeFromWeekdayMatch[2]);
    if (amount && normalizedWeekday) {
      const baseDate = getNextWeekday(normalizedWeekday, false);
      const targetDate = new Date(baseDate);
      targetDate.setDate(baseDate.getDate() + (amount * 7));
      const label = formatDateLabel(targetDate);
      const dateValue = targetDate.toISOString().split("T")[0];
      return {
        id: `date-${Date.now()}`,
        type: "date",
        value: dateValue,
        label,
        score: 0.84,
        source: "rule",
        resolvedEntityId: dateValue,
        blockingRequired: false,
        metadata: { originalText: relativeFromWeekdayMatch[0], calculatedDate: dateValue },
      };
    }
  }

  const relativeTimeMatch = text.match(RE_RELATIVE_TIME);
  if (relativeTimeMatch) {
    const amount = parseRelativeCount(relativeTimeMatch[1]);
    const unit = relativeTimeMatch[2].toLowerCase();
    if (amount && amount > 0) {
      const targetDate = new Date();
      if (unit.startsWith("day")) {
        targetDate.setDate(targetDate.getDate() + amount);
      } else if (unit.startsWith("week")) {
        targetDate.setDate(targetDate.getDate() + (amount * 7));
      } else if (unit.startsWith("month")) {
        targetDate.setMonth(targetDate.getMonth() + amount);
      }
      const label = formatDateLabel(targetDate);
      const dateValue = targetDate.toISOString().split("T")[0];
      return {
        id: `date-${Date.now()}`,
        type: "date",
        value: dateValue,
        label,
        score: 0.82,
        source: "rule",
        resolvedEntityId: dateValue,
        blockingRequired: false,
        metadata: { originalText: relativeTimeMatch[0], calculatedDate: dateValue },
      };
    }
  }

  const nextWeekWeekdayMatch = text.match(RE_NEXT_WEEK_WEEKDAY);
  if (nextWeekWeekdayMatch) {
    const weekday = nextWeekWeekdayMatch[1].toLowerCase();
    const targetDate = getNextWeekday(weekday, true);
    const label = formatDateLabel(targetDate);
    const dateValue = targetDate.toISOString().split('T')[0];
    return {
      id: `date-${Date.now()}`,
      type: 'date',
      value: dateValue,
      label,
      score: 0.85,
      source: 'rule',
      resolvedEntityId: dateValue,
      blockingRequired: false,
      metadata: { originalText: nextWeekWeekdayMatch[0], calculatedDate: dateValue }
    };
  }

  const nextWeekdayMatch = text.match(RE_NEXT_WEEKDAY);
  if (nextWeekdayMatch) {
    const weekday = nextWeekdayMatch[1].toLowerCase();
    const targetDate = getNextWeekday(weekday, true);
    const label = formatDateLabel(targetDate);
    const dateValue = targetDate.toISOString().split('T')[0];
    return {
      id: `date-${Date.now()}`,
      type: 'date',
      value: dateValue,
      label,
      score: 0.85,
      source: 'rule',
      resolvedEntityId: dateValue,
      blockingRequired: false,
      metadata: { originalText: nextWeekdayMatch[0], calculatedDate: dateValue }
    };
  }

  const beforeWeekdayMatch = text.match(RE_BEFORE_WEEKDAY);
  if (beforeWeekdayMatch) {
    const weekday = beforeWeekdayMatch[1].toLowerCase();
    const targetDate = getNextWeekday(weekday, false);
    const label = formatDateLabel(targetDate);
    const dateValue = targetDate.toISOString().split('T')[0];
    return {
      id: `date-${Date.now()}`,
      type: 'date',
      value: dateValue,
      label,
      score: 0.8,
      source: 'rule',
      resolvedEntityId: dateValue,
      blockingRequired: false,
      metadata: { originalText: beforeWeekdayMatch[0], calculatedDate: dateValue }
    };
  }
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const matchedText = match[0].toLowerCase();
      let label = matchedText;
      let dateValue = matchedText;
      let calculatedDate: Date | null = null;
      
      // Calculate actual dates for relative references
      if (matchedText === 'today') {
        calculatedDate = new Date();
        label = formatDateLabel(calculatedDate);
        dateValue = calculatedDate.toISOString().split('T')[0];
      } else if (matchedText === 'tomorrow') {
        calculatedDate = new Date();
        calculatedDate.setDate(calculatedDate.getDate() + 1);
        label = formatDateLabel(calculatedDate);
        dateValue = calculatedDate.toISOString().split('T')[0];
      } else if (matchedText === 'next week') {
        calculatedDate = new Date();
        calculatedDate.setDate(calculatedDate.getDate() + 7);
        label = formatDateLabel(calculatedDate);
        dateValue = calculatedDate.toISOString().split('T')[0];
      } else if (matchedText === 'this week') {
        // This week typically means by end of this week (Friday)
        calculatedDate = getNextWeekday('friday', false);
        label = formatDateLabel(calculatedDate);
        dateValue = calculatedDate.toISOString().split('T')[0];
      } else if (WEEKDAY_LIST.includes(matchedText)) {
        // Single weekday without "next" prefix - get next occurrence
        calculatedDate = getNextWeekday(matchedText, false);
        label = formatDateLabel(calculatedDate);
        dateValue = calculatedDate.toISOString().split('T')[0];
      } else {
        // For other patterns (specific dates), keep the original label
        label = matchedText.charAt(0).toUpperCase() + matchedText.slice(1);
      }
      
      return {
        id: `date-${Date.now()}`,
        type: 'date',
        value: dateValue,
        label,
        score: 0.8,
        source: 'rule',
        resolvedEntityId: calculatedDate ? dateValue : undefined,
        blockingRequired: false,
        metadata: calculatedDate ? { 
          originalText: matchedText,
          calculatedDate: dateValue
        } : undefined
      };
    }
  }

  const standaloneWeekdayMatch = text.match(RE_STANDALONE_WEEKDAY);
  if (standaloneWeekdayMatch) {
    const weekday = standaloneWeekdayMatch[1];
    const normalizedWeekday = normalizeWeekdayToken(weekday);
    if (normalizedWeekday) {
      const targetDate = getNextWeekday(normalizedWeekday, false);
      const label = formatDateLabel(targetDate);
      const dateValue = targetDate.toISOString().split("T")[0];
      return {
        id: `date-${Date.now()}`,
        type: "date",
        value: dateValue,
        label,
        score: 0.8,
        source: "rule",
        resolvedEntityId: dateValue,
        blockingRequired: false,
        metadata: { originalText: standaloneWeekdayMatch[0], calculatedDate: dateValue },
      };
    }
  }
  
  return null;
}
