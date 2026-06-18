import dotenv from 'dotenv';
dotenv.config();

export async function searchActorBio(actorName: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.warn('FIRECRAWL_API_KEY is missing. Search skipped.');
    return '';
  }

  const query = `${actorName} Nollywood biography Instagram Facebook`;
  
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        query: query,
        limit: 3, // Get top 3 results for context
        scrapeOptions: {
          formats: ['markdown']
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Firecrawl Search Failed [${response.status}]:`, errorText);
      return '';
    }

    const data = await response.json();
    
    if (!data.success || !data.data || data.data.length === 0) {
      return '';
    }

    // Combine the markdown results into a single context block
    let context = `Search Results for "${actorName}":\n\n`;
    for (const result of data.data) {
      context += `Source: ${result.url}\n`;
      context += `Content:\n${result.markdown?.substring(0, 2000) || result.description || ''}\n\n`;
    }

    return context;
  } catch (error) {
    console.error('Error in searchActorBio:', error);
    return '';
  }
}

export async function searchDiscoverList(region: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.warn('FIRECRAWL_API_KEY is missing. Search skipped.');
    return '';
  }

  const query = `upcoming ${region} nollywood actors listicle 2024 2025`;
  
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        query: query,
        limit: 3, 
        scrapeOptions: {
          formats: ['markdown']
        }
      })
    });

    if (!response.ok) return '';

    const data = await response.json();
    if (!data.success || !data.data) return '';

    let context = `Search Results for Discovery:\n\n`;
    for (const result of data.data) {
      context += `Source: ${result.url}\n`;
      context += `Content:\n${result.markdown?.substring(0, 3000) || result.description || ''}\n\n`;
    }

    return context;
  } catch (error) {
    console.error('Error in searchDiscoverList:', error);
    return '';
  }
}
