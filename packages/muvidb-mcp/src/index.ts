import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { searchFilms, getFilmDetails, getFilmCredits, getWhereToWatch } from './tools/films';
import { searchPeople, getPersonFilmography } from './tools/people';
import { getAwardsAndNominations } from './tools/awards';
import { getBoxOfficeRankings } from './tools/boxOffice';

export function createMcpServer() {
  const server = new McpServer({
    name: 'muvidb-mcp',
    version: '1.0.0'
  });

  // Tool 1: search_films
  server.tool(
    'search_films',
    'Search Nollywood and African films, TV/web series, short films, and stage plays by title, genre, year, or keyword.',
    {
      query: z.string().describe('Title, keywords, or theme to search for'),
      content_type: z
        .enum(['movie', 'series', 'short', 'documentary', 'feature_film'])
        .optional()
        .describe('Filter by content type'),
      year: z.number().int().optional().describe('Filter by release year (e.g. 2024, 2025, 2026)'),
      limit: z.number().int().min(1).max(50).default(10).optional().describe('Maximum number of results (default 10)')
    },
    async (args) => {
      const result = await searchFilms(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }
  );

  // Tool 2: get_film_details
  server.tool(
    'get_film_details',
    'Get full verified profile for a film or series: synopsis, runtime, director, distributors, streaming links, and awards.',
    {
      film_id: z.string().uuid().optional().describe('Unique UUID of the film in MuviDB'),
      title: z.string().optional().describe('Exact or approximate title of the film')
    },
    async (args) => {
      const result = await getFilmDetails(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }
  );

  // Tool 3: get_film_credits
  server.tool(
    'get_film_credits',
    'Get complete, verified cast and crew credits (with zero-hallucinations, billing order, and specific character roles).',
    {
      film_id: z.string().uuid().optional().describe('Unique UUID of the film in MuviDB'),
      title: z.string().optional().describe('Title of the film')
    },
    async (args) => {
      const result = await getFilmCredits(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }
  );

  // Tool 4: get_where_to_watch
  server.tool(
    'get_where_to_watch',
    'Find where a Nollywood film is streaming (Netflix, Prime Video, YouTube, Showmax) or if it is currently showing in Nigerian cinemas.',
    {
      title: z.string().describe('Title of the movie or series')
    },
    async (args) => {
      const result = await getWhereToWatch(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }
  );

  // Tool 5: search_people
  server.tool(
    'search_people',
    'Search African cinema actors, directors, writers, producers, and crew by name.',
    {
      query: z.string().describe('Name or alias of the person'),
      limit: z.number().int().min(1).max(50).default(10).optional().describe('Max results to return')
    },
    async (args) => {
      const result = await searchPeople(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }
  );

  // Tool 6: get_person_filmography
  server.tool(
    'get_person_filmography',
    'Get full verified filmography of an actor or filmmaker, grouped by department (directing, writing, producing, acting).',
    {
      person_id: z.string().uuid().optional().describe('UUID of the person in MuviDB'),
      name: z.string().optional().describe('Name of the person (e.g. Funke Akindele, Lateef Adedimeji, Kayode Kasum)')
    },
    async (args) => {
      const result = await getPersonFilmography(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }
  );

  // Tool 7: get_awards_and_nominations
  server.tool(
    'get_awards_and_nominations',
    'Query African cinema awards and nominations (AMAA, BON, REFFA, AMVCA, AFRIFF, TINFF) by ceremony, year, film, or nominee.',
    {
      organization: z.string().optional().describe('Award organization (e.g. AMAA, BON, REFFA, AMVCA, AFRIFF)'),
      year: z.number().int().optional().describe('Year of the award ceremony (e.g. 2026, 2025, 2024)'),
      work: z.string().optional().describe('Filter by film title'),
      person: z.string().optional().describe('Filter by nominee or recipient name'),
      winners_only: z.boolean().default(false).optional().describe('Filter to only show winners')
    },
    async (args) => {
      const result = await getAwardsAndNominations(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }
  );

  // Tool 8: get_box_office_rankings
  server.tool(
    'get_box_office_rankings',
    'Get Nollywood box office rankings, all-time record holders, and yearly performance metrics.',
    {
      timeframe: z.enum(['all_time', 'yearly']).default('all_time').optional().describe('Timeframe of rankings'),
      year: z.number().int().optional().describe('Year (if timeframe is yearly)'),
      limit: z.number().int().min(1).max(50).default(10).optional().describe('Number of films to return')
    },
    async (args) => {
      const result = await getBoxOfficeRankings(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }
  );

  return server;
}

export async function startServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MuviDB MCP Server is running over STDIO.');
}
