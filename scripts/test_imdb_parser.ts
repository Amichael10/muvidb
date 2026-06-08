import fs from 'fs';

interface ImdbCredit {
  imdbId: string;
  name: string;
  role: string;
  characterName?: string;
}

function parseImdbCredits(markdown: string): ImdbCredit[] {
  const credits: ImdbCredit[] = [];
  
  // Find all sections
  const sectionHeaders = [
    'Director', 'Writer', 'Cast', 'Producers', 'Composer', 'Cinematographer', 'Editor',
    'Makeup Department', 'Sound Department', 'Production Management', 'Camera and Electrical Department',
    'Costume and Wardrobe Department', 'Editorial Department', 'Location Management', 'Script and Continuity Department'
  ];
  
  // Find the positions of each section header
  interface SectionPos {
    name: string;
    index: number;
  }
  const positions: SectionPos[] = [];
  
  for (const header of sectionHeaders) {
    const escaped = header.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\[\\*\\*${escaped}\\*\\*\\]`, 'gi');
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      positions.push({ name: header, index: match.index });
    }
  }
  
  // Sort positions by index
  positions.sort((a, b) => a.index - b.index);
  
  // Slice markdown into sections
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end = i + 1 < positions.length ? positions[i + 1].index : markdown.length;
    const sectionName = positions[i].name;
    const sectionContent = markdown.substring(start, end);
    
    // Find all name links in this section
    // Format: [Name](https://www.imdb.com/name/nmXXXXXXX/...)
    const nameRegex = /\[([^\]]+)\]\(https:\/\/www\.imdb\.com\/name\/(nm\d+)\/[^)]*\)/gi;
    let nameMatch;
    
    // Map to deduplicate credits within the same section
    const sectionCreditsMap = new Map<string, ImdbCredit>();
    
    while ((nameMatch = nameRegex.exec(sectionContent)) !== null) {
      let rawName = nameMatch[1].trim();
      const imdbId = nameMatch[2];
      
      // Strip "Go to " prefix if present
      if (rawName.toLowerCase().startsWith('go to ')) {
        rawName = rawName.substring(6).trim();
      }
      
      // We skip duplicate names unless we need to update/find their character name
      if (!sectionCreditsMap.has(imdbId)) {
        sectionCreditsMap.set(imdbId, {
          imdbId,
          name: rawName,
          role: sectionName === 'Cast' ? 'actor' : sectionName
        });
      } else {
        // If the current name doesn't start with "Go to", it might be the clean name, so update it
        const existing = sectionCreditsMap.get(imdbId)!;
        if (!nameMatch[1].trim().toLowerCase().startsWith('go to ')) {
          existing.name = rawName;
        }
      }
    }
    
    // For Cast section, also parse character names
    if (sectionName === 'Cast') {
      // Format: [CharacterName](https://www.imdb.com/title/ttXXXXXXX/characters/nmXXXXXXX/...)
      const charRegex = /\[([^\]]+)\]\(https:\/\/www\.imdb\.com\/title\/[^\/]+\/characters\/(nm\d+)\/[^)]*\)/gi;
      let charMatch;
      while ((charMatch = charRegex.exec(sectionContent)) !== null) {
        const characterName = charMatch[1].trim();
        const imdbId = charMatch[2];
        const credit = sectionCreditsMap.get(imdbId);
        if (credit) {
          credit.characterName = characterName;
        }
      }
    }
    
    // Add all credits from this section to total credits
    for (const credit of sectionCreditsMap.values()) {
      credits.push(credit);
    }
  }
  
  return credits;
}

function run() {
  const markdown = fs.readFileSync('scripts/imdb_divine_lies.md', 'utf-8');
  const credits = parseImdbCredits(markdown);
  console.log(`Parsed ${credits.length} credits:`);
  console.log(JSON.stringify(credits, null, 2));
}

run();
