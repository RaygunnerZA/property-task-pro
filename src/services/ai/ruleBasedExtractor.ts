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
  properties?: Array<{ id: string; name?: string; nickname?: string; address?: string }>;
  assets?: Array<{ id: string; name?: string; serial?: string }>;
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
  const originalText = context.originalText || context.description;
  const personChips = detectPersons(text, words, entities.members, originalText);
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
  
  // 6. Property detection
  const propertyChips = detectProperties(text, words, entities.properties || []);
  chips.push(...propertyChips);
  
  // 7. Asset detection
  const assetChips = detectAssets(text, words, entities.assets || []);
  chips.push(...assetChips);
  
  // 8. Date detection
  const dateChip = detectDate(text);
  if (dateChip) {
    chips.push(dateChip);
  }
  
  // 9. Urgency-based ghost group
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
  
  // PREVENT AUTO-INSERTION: Preserve user-typed terms, don't replace with DB entity names
  // Direct space name matching - check for exact matches first
  for (const space of filteredSpaces) {
    const spaceName = space.name.toLowerCase();
    
    // Check for exact match in text (case-insensitive)
    const exactMatchWord = words.find(w => w.toLowerCase() === spaceName);
    if (exactMatchWord) {
      // Exact match - can auto-resolve
      chips.push({
        id: `space-${space.id}`,
        type: 'space',
        value: space.id,
        label: exactMatchWord, // Preserve user's typed term
        score: 0.95,
        source: 'rule',
        resolvedEntityId: space.id, // Exact match can be auto-resolved
        resolvedEntityType: 'space'
      });
    } else {
      // Check for fuzzy match - create chip with typed term, not DB entity name
      const fuzzyMatchWord = words.find(w => isFuzzyMatch(w, spaceName));
      if (fuzzyMatchWord) {
        // Fuzzy match - preserve typed term, don't auto-resolve
        chips.push({
          id: `space-suggested-${space.id}-${fuzzyMatchWord}`,
          type: 'space',
          value: fuzzyMatchWord, // Use typed term, not DB entity ID
          label: fuzzyMatchWord, // Preserve user's typed term
          score: 0.75,
          source: 'rule',
          metadata: { 
            suggestedEntityId: space.id, 
            suggestedEntityName: space.name 
          }
        });
      }
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
 * Also detects unknown capitalized names as invite candidates
 */
function detectPersons(
  text: string,
  words: string[],
  members: Array<{ id: string; user_id: string; display_name: string }>,
  originalText: string
): SuggestedChip[] {
  const chips: SuggestedChip[] = [];
  const matchedNames = new Set<string>();
  
  // PREVENT AUTO-INSERTION: Preserve user-typed terms, don't replace with DB entity names
  for (const member of members) {
    const displayName = member.display_name.toLowerCase();
    const nameParts = displayName.split(' ').filter(p => p.length > 2);
    
    // Check for exact match first
    const exactMatchWord = words.find(w => {
      const wLower = w.toLowerCase();
      return wLower === displayName || nameParts.some(part => wLower === part);
    });
    
    if (exactMatchWord) {
      matchedNames.add(exactMatchWord.toLowerCase());
      // Exact match - can auto-resolve
      chips.push({
        id: `person-${member.user_id}`,
        type: 'person',
        value: exactMatchWord, // Preserve typed term
        label: exactMatchWord, // Preserve user's typed term
        score: 0.9,
        source: 'rule',
        resolvedEntityId: member.user_id, // Exact match can be auto-resolved
        resolvedEntityType: 'person',
        blockingRequired: false // Resolved, no blocking needed
      });
    } else {
      // Check for fuzzy match - preserve typed term
      const fuzzyMatchWord = words.find(w => {
        const wLower = w.toLowerCase();
        return nameParts.some(part => isFuzzyMatch(wLower, part));
      });
      
      if (fuzzyMatchWord) {
        matchedNames.add(fuzzyMatchWord.toLowerCase());
        // Fuzzy match - preserve typed term, don't auto-resolve
        chips.push({
          id: `person-suggested-${member.user_id}-${fuzzyMatchWord}`,
          type: 'person',
          value: fuzzyMatchWord, // Use typed term, not DB entity ID
          label: fuzzyMatchWord, // Preserve user's typed term
          score: 0.7,
          source: 'rule',
          blockingRequired: true, // Needs resolution
          metadata: { 
            suggestedEntityId: member.user_id, 
            suggestedEntityName: member.display_name 
          }
        });
      }
    }
  }
  
  // Detect unknown capitalized names (potential invite candidates)
  // Look for capitalized words that aren't matched to existing members
  const originalWords = originalText.split(/\s+/);
  const memberNames = new Set(members.map(m => m.display_name.toLowerCase()));
  
  for (const word of originalWords) {
    // Check if word is capitalized (starts with uppercase) and is a name-like word
    if (word.length > 2 && word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
      const wordLower = word.toLowerCase();
      // Skip if already matched or if it's a common word
      if (!matchedNames.has(wordLower) && 
          !memberNames.has(wordLower) &&
          !['The', 'At', 'In', 'On', 'To', 'For', 'With', 'From', 'Next', 'This', 'That'].includes(word)) {
        // Check if it appears in a person-like context (before "must", "should", "will", etc.)
        const wordIndex = originalText.indexOf(word);
        const afterWord = originalText.substring(wordIndex + word.length).trim().toLowerCase();
        if (afterWord.match(/^(must|should|will|needs?|has|have|is|are)/)) {
        chips.push({
          id: `person-invite-${word}-${Date.now()}`,
          type: 'person',
          value: word,
          label: word,
          score: 0.75,
          source: 'rule',
          blockingRequired: false, // Invite chips are fact chips, not blocking verb chips
          metadata: { 
            isInviteCandidate: true,
            inviteName: word
          }
        });
          matchedNames.add(wordLower);
          break; // Only detect first unknown person name
        }
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
  
  // PREVENT AUTO-INSERTION: Preserve user-typed terms, don't replace with DB entity names
  for (const team of teams) {
    const teamName = team.name.toLowerCase();
    const teamWords = teamName.split(' ').filter(w => w.length > 2);
    
    // Check for exact match first
    const exactMatchWord = words.find(w => {
      const wLower = w.toLowerCase();
      return wLower === teamName || teamWords.some(tw => wLower === tw);
    });
    
    if (exactMatchWord) {
      // Exact match - can auto-resolve
      chips.push({
        id: `team-${team.id}`,
        type: 'team',
        value: exactMatchWord, // Preserve typed term
        label: exactMatchWord, // Preserve user's typed term
        score: 0.85,
        source: 'rule',
        resolvedEntityId: team.id, // Exact match can be auto-resolved
        resolvedEntityType: 'team'
      });
    } else {
      // Check for fuzzy match - preserve typed term
      const fuzzyMatchWord = words.find(w => {
        const wLower = w.toLowerCase();
        return text.includes(teamName) || teamWords.some(tw => isFuzzyMatch(wLower, tw));
      });
      
      if (fuzzyMatchWord) {
        // Fuzzy match - preserve typed term, don't auto-resolve
        chips.push({
          id: `team-suggested-${team.id}-${fuzzyMatchWord}`,
          type: 'team',
          value: fuzzyMatchWord, // Use typed term, not DB entity ID
          label: fuzzyMatchWord, // Preserve user's typed term
          score: 0.65,
          source: 'rule',
          metadata: { 
            suggestedEntityId: team.id, 
            suggestedEntityName: team.name 
          }
        });
      }
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
      let resolvedValue: string | undefined = undefined;
      
      // Normalize common patterns
      if (matchedText === 'today') {
        label = 'Today';
        const today = new Date();
        resolvedValue = today.toISOString().split('T')[0];
      } else if (matchedText === 'tomorrow') {
        label = 'Tomorrow';
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        resolvedValue = tomorrow.toISOString().split('T')[0];
      } else if (matchedText === 'next week') {
        label = 'Next Week';
      } else if (matchedText === 'this week') {
        label = 'This Week';
      } else if (matchedText.startsWith('next ')) {
        // "next wednesday" pattern
        const dayName = matchedText.replace('next ', '');
        label = `Next ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}`;
        // Calculate next occurrence of that weekday
        const dayMap: Record<string, number> = {
          'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
          'friday': 5, 'saturday': 6, 'sunday': 0
        };
        const targetDay = dayMap[dayName];
        if (targetDay !== undefined) {
          const today = new Date();
          const currentDay = today.getDay();
          let daysUntil = (targetDay - currentDay + 7) % 7;
          if (daysUntil === 0) daysUntil = 7; // Next week if today is that day
          const nextDate = new Date(today);
          nextDate.setDate(today.getDate() + daysUntil);
          resolvedValue = nextDate.toISOString().split('T')[0];
        }
      } else {
        label = matchedText.charAt(0).toUpperCase() + matchedText.slice(1);
      }
      
      return {
        id: `date-${Date.now()}`,
        type: 'date',
        value: resolvedValue || matchedText,
        label,
        score: 0.8,
        source: 'rule',
        resolvedEntityId: resolvedValue ? resolvedValue : undefined, // Auto-resolve if we calculated a date
        blockingRequired: !resolvedValue // Block if not resolved
      };
    }
  }
  
  return null;
}

/**
 * Detect properties from text
 */
function detectProperties(
  text: string,
  words: string[],
  properties: Array<{ id: string; name?: string; nickname?: string; address?: string }>
): SuggestedChip[] {
  const chips: SuggestedChip[] = [];
  
  for (const property of properties) {
    const propertyName = (property.nickname || property.name || property.address || '').toLowerCase();
    if (!propertyName) continue;
    
    const propertyWords = propertyName.split(' ').filter(w => w.length > 2);
    
    // Check for exact match
    const exactMatch = words.find(w => {
      const wLower = w.toLowerCase();
      return wLower === propertyName || propertyWords.some(pw => wLower === pw);
    });
    
    if (exactMatch) {
      chips.push({
        id: `property-${property.id}`,
        type: 'property',
        value: property.id,
        label: exactMatch,
        score: 0.9,
        source: 'rule',
        resolvedEntityId: property.id,
        resolvedEntityType: 'property',
        blockingRequired: false
      });
    } else {
      // Check for fuzzy match or partial match
      const fuzzyMatch = words.find(w => {
        const wLower = w.toLowerCase();
        return text.includes(propertyName) || propertyWords.some(pw => isFuzzyMatch(wLower, pw));
      });
      
      if (fuzzyMatch) {
        chips.push({
          id: `property-suggested-${property.id}-${fuzzyMatch}`,
          type: 'property',
          value: fuzzyMatch,
          label: fuzzyMatch,
          score: 0.7,
          source: 'rule',
          blockingRequired: true,
          metadata: {
            suggestedEntityId: property.id,
            suggestedEntityName: property.nickname || property.name || property.address
          }
        });
      }
    }
  }
  
  // Also detect common property indicators like "the cottage", "at the [name]"
  const propertyPhrasePattern = /\b(?:the|at|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
  let match;
  while ((match = propertyPhrasePattern.exec(text)) !== null) {
    const propertyName = match[1].toLowerCase();
    // Check if it's not already matched to an existing property
    const alreadyMatched = properties.some(p => {
      const pName = (p.nickname || p.name || p.address || '').toLowerCase();
      return pName.includes(propertyName) || propertyName.includes(pName);
    });
    
    if (!alreadyMatched && propertyName.length > 2) {
      chips.push({
        id: `property-ghost-${propertyName}-${Date.now()}`,
        type: 'property',
        value: match[1], // Preserve original capitalization
        label: match[1],
        score: 0.65,
        source: 'rule',
        blockingRequired: true,
        metadata: {
          isGhostEntity: true,
          ghostName: match[1]
        }
      });
      break; // Only detect first unmatched property reference
    }
  }
  
  return chips;
}

/**
 * Detect assets from text
 */
function detectAssets(
  text: string,
  words: string[],
  assets: Array<{ id: string; name?: string; serial?: string }>
): SuggestedChip[] {
  const chips: SuggestedChip[] = [];
  const { assetKeywords } = extractionPatterns;
  
  // First, try to match against existing assets
  for (const asset of assets) {
    const assetName = (asset.name || asset.serial || '').toLowerCase();
    if (!assetName) continue;
    
    const exactMatch = words.find(w => w.toLowerCase() === assetName);
    if (exactMatch) {
      chips.push({
        id: `asset-${asset.id}`,
        type: 'asset',
        value: asset.id,
        label: exactMatch,
        score: 0.9,
        source: 'rule',
        resolvedEntityId: asset.id,
        resolvedEntityType: 'asset',
        blockingRequired: false
      });
    }
  }
  
  // Then, detect common asset keywords
  for (const keyword of assetKeywords) {
    if (text.includes(keyword)) {
      // Check if already matched to an existing asset
      const alreadyMatched = assets.some(a => {
        const aName = (a.name || a.serial || '').toLowerCase();
        return aName.includes(keyword) || keyword.includes(aName);
      });
      
      if (!alreadyMatched) {
        chips.push({
          id: `asset-ghost-${keyword}-${Date.now()}`,
          type: 'asset',
          value: keyword,
          label: keyword,
          score: 0.7,
          source: 'rule',
          blockingRequired: true,
          metadata: {
            isGhostEntity: true,
            ghostName: keyword
          }
        });
        break; // Only detect first unmatched asset
      }
    }
  }
  
  return chips;
}
