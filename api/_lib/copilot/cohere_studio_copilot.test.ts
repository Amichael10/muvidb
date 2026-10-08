import { describe, it, expect, beforeAll } from 'vitest';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';

const { COPILOT_TOOLS, executeCopilotTool } = await import('./cohere_studio_copilot.js');

describe('Cohere Studio Copilot Tools', () => {
  it('exposes get_latest_films and batch_schedule_posts in tool declarations', () => {
    const toolNames = COPILOT_TOOLS.map((t) => t.name);
    expect(toolNames).toContain('get_latest_films');
    expect(toolNames).toContain('batch_schedule_posts');
    expect(toolNames).toContain('create_social_draft');
    expect(toolNames).toContain('search_database');
  });

  it('declares proper parameter definitions for get_latest_films', () => {
    const latestFilmsTool = COPILOT_TOOLS.find((t) => t.name === 'get_latest_films');
    expect(latestFilmsTool).toBeDefined();
    expect(latestFilmsTool?.parameterDefinitions.platform).toBeDefined();
    expect(latestFilmsTool?.parameterDefinitions.limit).toBeDefined();
    expect(latestFilmsTool?.parameterDefinitions.require_portrait_poster).toBeDefined();
  });

  it('declares proper parameter definitions for batch_schedule_posts', () => {
    const batchTool = COPILOT_TOOLS.find((t) => t.name === 'batch_schedule_posts');
    expect(batchTool).toBeDefined();
    expect(batchTool?.parameterDefinitions.film_ids).toBeDefined();
    expect(batchTool?.parameterDefinitions.start_date).toBeDefined();
    expect(batchTool?.parameterDefinitions.status).toBeDefined();
  });

  it('validates empty film_ids when calling batch_schedule_posts', async () => {
    const actor = { id: 'test-admin', email: 'admin@muvidb.com', role: 'admin' };
    const res = await executeCopilotTool('batch_schedule_posts', { film_ids: '' }, actor);
    expect(res).toEqual({ error: 'Please provide at least one film_id to schedule' });
  });
});
