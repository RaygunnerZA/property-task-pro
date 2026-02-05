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
  
  const text = context.description.toLowerCase();
  const words = extractWords(context.description);
  
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
  
  // 4. Person detection
  const personChips = detectPersons(text, words, entities.members);
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

/**
 * Detect compliance mode from text
 */
function detectComplianceMode(text: string): boolean {
  return extractionPatterns.complianceKeywords.some(keyword => 
    text.includes(keyword.toLowerCase())
  );
}

/**
 * Common space/location keywords that indicate a space name
 */
const spaceKeywords = [
  'room', 'kitchen', 'bathroom', 'bedroom', 'living', 'garden', 'garage', 'office',
  'hall', 'hallway', 'entrance', 'cottage', 'house', 'flat', 'apartment', 'unit',
  'basement', 'attic', 'loft', 'cellar', 'shed', 'outbuilding', 'annex', 'studio',
  'ensuite', 'utility', 'pantry', 'laundry', 'conservatory', 'patio', 'deck',
  'balcony', 'terrace', 'yard', 'driveway', 'parking', 'lobby', 'foyer', 'landing'
];

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
  
  // Look for potential space names that didn't match existing spaces
  // Pattern: Words that match space keywords or capitalized location-like names
  const originalText = text;
  
  // Check for space keywords in text
  for (const keyword of spaceKeywords) {
    const keywordLower = keyword.toLowerCase();
    if (text.includes(keywordLower) && !matchedSpaces.has(keywordLower)) {
      // Found a space keyword not matched to existing spaces
      // Look for the full phrase (e.g., "the cottage", "main kitchen")
      const patterns = [
        new RegExp(`\\b(the\\s+)?${keywordLower}\\b`, 'i'),
        new RegExp(`\\b\\w+\\s+${keywordLower}\\b`, 'i'),
        new RegExp(`\\b${keywordLower}\\s+\\w+\\b`, 'i')
      ];
      
      for (const pattern of patterns) {
        const match = originalText.match(pattern);
        if (match) {
          const spaceName = match[0].replace(/^the\s+/i, '').trim();
          const spaceNameLower = spaceName.toLowerCase();
          
          if (!matchedSpaces.has(spaceNameLower)) {
            // Capitalize properly
            const formattedName = spaceName.split(' ')
              .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ');
            
            chips.push({
              id: `space-ghost-${spaceNameLower.replace(/\s+/g, '-')}-${Date.now()}`,
              type: 'space',
              value: formattedName,
              label: formattedName,
              score: 0.55,
              source: 'rule',
              blockingRequired: true, // Requires resolution (add to spaces)
              metadata: { detectedAs: 'potential_space' }
            });
            matchedSpaces.add(spaceNameLower);
            break;
          }
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

/**
 * Common words to exclude from name detection
 */
const commonWords = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'up', 'about', 'into', 'over', 'after', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'can', 'need', 'needs', 'fix', 'repair', 'replace', 'check',
  'clean', 'paint', 'install', 'remove', 'update', 'change', 'add', 'get', 'set', 'put',
  'make', 'take', 'give', 'help', 'call', 'contact', 'send', 'next', 'this', 'that',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'today', 'tomorrow', 'week', 'month', 'year', 'urgent', 'asap', 'important'
]);

/**
 * Detect persons from text using fuzzy matching
 * Also detects potential person names that don't match existing members (creates verb/ghost chips)
 */
function detectPersons(
  text: string,
  words: string[],
  members: Array<{ id: string; user_id: string; display_name: string }>
): SuggestedChip[] {
  const chips: SuggestedChip[] = [];
  const matchedNames = new Set<string>();
  
  // First, try to match against existing members
  for (const member of members) {
    const displayName = member.display_name.toLowerCase();
    const nameParts = displayName.split(' ');
    
    // Check if any name part matches words in text
    for (const part of nameParts) {
      if (part.length > 2 && words.some(w => isFuzzyMatch(w, part))) {
        chips.push({
          id: `person-${member.user_id}`,
          type: 'person',
          value: member.user_id,
          label: member.display_name,
          score: 0.75,
          source: 'rule',
          resolvedEntityId: member.user_id,
          blockingRequired: false
        });
        matchedNames.add(part.toLowerCase());
        break;
      }
    }
  }
  
  // Then, look for potential person names that didn't match existing members
  // Pattern: Capitalized words that look like names (e.g., "Frank", "James")
  const originalText = text;
  const namePattern = /\b([A-Z][a-z]{2,})\b/g;
  let match;
  
  while ((match = namePattern.exec(originalText)) !== null) {
    const potentialName = match[1];
    const nameLower = potentialName.toLowerCase();
    
    // Skip if already matched to existing member
    if (matchedNames.has(nameLower)) continue;
    
    // Skip common words
    if (commonWords.has(nameLower)) continue;
    
    // Skip if it looks like a space/location name (e.g., Kitchen, Bathroom)
    const spaceKeywords = ['room', 'kitchen', 'bathroom', 'bedroom', 'living', 'garden', 'garage', 'office', 'hall', 'entrance', 'cottage', 'house', 'flat', 'apartment'];
    if (spaceKeywords.some(k => nameLower.includes(k) || k.includes(nameLower))) continue;
    
    // This looks like a person name - create a ghost/verb chip
    chips.push({
      id: `person-ghost-${nameLower}-${Date.now()}`,
      type: 'person',
      value: potentialName,
      label: potentialName,
      score: 0.6,
      source: 'rule',
      blockingRequired: true, // Requires resolution (invite or choose existing)
      metadata: { detectedAs: 'potential_name' }
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
function getNextWeekday(weekdayName: string, skipCurrent: boolean = false): Date {
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = new Date();
  const targetDay = weekdays.indexOf(weekdayName.toLowerCase());
  
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

/**
 * Detect date references from text
 */
function detectDate(text: string): SuggestedChip | null {
  const { datePatterns } = extractionPatterns;
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  // Check for "next [weekday]" pattern first
  const nextWeekdayMatch = text.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (nextWeekdayMatch) {
    const weekday = nextWeekdayMatch[1].toLowerCase();
    const targetDate = getNextWeekday(weekday, true); // Skip to next week's occurrence
    const label = formatDateLabel(targetDate);
    const dateValue = targetDate.toISOString().split('T')[0];
    
    return {
      id: `date-${Date.now()}`,
      type: 'date',
      value: dateValue,
      label,
      score: 0.85,
      source: 'rule',
      resolvedEntityId: dateValue, // Store the actual date
      blockingRequired: false,
      metadata: { 
        originalText: nextWeekdayMatch[0],
        calculatedDate: dateValue
      }
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
      } else if (weekdays.includes(matchedText)) {
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
  
  return null;
}
