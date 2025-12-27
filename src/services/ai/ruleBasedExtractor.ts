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
 * Detect spaces from text using fuzzy matching
 */
function detectSpaces(
  text: string,
  words: string[],
  spaces: Array<{ id: string; name: string; property_id: string }>,
  propertyId?: string
): SuggestedChip[] {
  const chips: SuggestedChip[] = [];
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
        source: 'rule'
      });
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
            metadata: { matchedAsset: asset }
          });
          break; // Only add first matching space
        }
      }
    }
  }
  
  return chips;
}

/**
 * Detect persons from text using fuzzy matching
 */
function detectPersons(
  text: string,
  words: string[],
  members: Array<{ id: string; user_id: string; display_name: string }>
): SuggestedChip[] {
  const chips: SuggestedChip[] = [];
  
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
          source: 'rule'
        });
        break;
      }
    }
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
 * Detect date references from text
 */
function detectDate(text: string): SuggestedChip | null {
  const { datePatterns } = extractionPatterns;
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const matchedText = match[0].toLowerCase();
      let label = matchedText;
      
      // Normalize common patterns
      if (matchedText === 'today') label = 'Today';
      else if (matchedText === 'tomorrow') label = 'Tomorrow';
      else if (matchedText === 'next week') label = 'Next Week';
      else if (matchedText === 'this week') label = 'This Week';
      else label = matchedText.charAt(0).toUpperCase() + matchedText.slice(1);
      
      return {
        id: `date-${Date.now()}`,
        type: 'date',
        value: matchedText,
        label,
        score: 0.8,
        source: 'rule'
      };
    }
  }
  
  return null;
}
