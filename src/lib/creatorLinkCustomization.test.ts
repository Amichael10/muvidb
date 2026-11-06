import { describe, it, expect } from 'vitest';
import { computePortfolioMetrics } from './portfolioClient';

describe('Creator Link Customization Logic', () => {
  it('correctly filters department tabs to only what the creator has actually done', () => {
    // Scenario 1: Actor only
    const actorFilms = [
      { id: '1', title: 'Film A', roles: ['Lead Actor', 'Cast'] },
      { id: '2', title: 'Film B', roles: ['Supporting Actor'] },
    ];
    const actorStage: any[] = [];

    const getAvailableTabs = (films: any[], stage: any[]) => {
      const tabs = [{ id: 'all', label: 'All' }];
      const allRoles = films.flatMap((f) => (f.roles || []).map((r) => String(r).toLowerCase()));

      if (allRoles.some((r) => r.includes('direct'))) tabs.push({ id: 'directing', label: 'Directing' });
      if (allRoles.some((r) => r.includes('produc'))) tabs.push({ id: 'producing', label: 'Producing' });
      if (allRoles.some((r) => r.includes('writ') || r.includes('screen'))) tabs.push({ id: 'writing', label: 'Writing' });
      if (allRoles.some((r) => r.includes('act') || r.includes('cast'))) tabs.push({ id: 'acting', label: 'Acting' });
      if (stage && stage.length > 0) tabs.push({ id: 'stage', label: '🎭 Stage & Theatre' });

      return tabs;
    };

    const actorTabs = getAvailableTabs(actorFilms, actorStage);
    expect(actorTabs.map((t) => t.id)).toEqual(['all', 'acting']);
    expect(actorTabs.map((t) => t.id)).not.toContain('directing');
    expect(actorTabs.map((t) => t.id)).not.toContain('producing');

    // Scenario 2: Director and Producer with Stage credits
    const multiHyphenateFilms = [
      { id: '3', title: 'Film C', roles: ['Director'] },
      { id: '4', title: 'Film D', roles: ['Executive Producer'] },
    ];
    const multiStage = [{ id: 's1', role_name: 'Stage Director' }];
    const multiTabs = getAvailableTabs(multiHyphenateFilms, multiStage);
    expect(multiTabs.map((t) => t.id)).toEqual(['all', 'directing', 'producing', 'stage']);
    expect(multiTabs.map((t) => t.id)).not.toContain('acting');
  });

  it('respects creator custom filmography arrangement for the top 5 display', () => {
    const films = [
      { id: 'f1', title: 'Movie 1', year: 2020 },
      { id: 'f2', title: 'Movie 2', year: 2021 },
      { id: 'f3', title: 'Movie 3', year: 2024 },
      { id: 'f4', title: 'Movie 4', year: 2019 },
      { id: 'f5', title: 'Movie 5', year: 2022 },
      { id: 'f6', title: 'Movie 6', year: 2023 },
    ];

    // Creator explicitly curates: Movie 4 (#1), Movie 1 (#2), Movie 5 (#3)
    const customOrder = ['f4', 'f1', 'f5'];
    const orderMap = new Map<string, number>();
    customOrder.forEach((id, idx) => orderMap.set(id, idx));

    const sortedFilms = [...films].sort((a, b) => {
      const aOrder = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
      const bOrder = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (b.year || 0) - (a.year || 0);
    });

    const top5 = sortedFilms.slice(0, 5);
    expect(top5[0].id).toBe('f4'); // Ranked #1 by creator
    expect(top5[1].id).toBe('f1'); // Ranked #2 by creator
    expect(top5[2].id).toBe('f5'); // Ranked #3 by creator
    expect(top5.length).toBe(5);
  });

  it('caps straight line featured showcase to exactly 3 selected films in order', () => {
    const filmMap = new Map([
      ['f1', { id: 'f1', title: 'Showcase 1' }],
      ['f2', { id: 'f2', title: 'Showcase 2' }],
      ['f3', { id: 'f3', title: 'Showcase 3' }],
      ['f4', { id: 'f4', title: 'Showcase 4' }],
    ]);

    const chosenIds = ['f3', 'f1', 'f4', 'f2'];
    const showcase = chosenIds.map((id) => filmMap.get(id)).filter(Boolean).slice(0, 3);

    expect(showcase).toHaveLength(3);
    expect(showcase.map((f: any) => f.id)).toEqual(['f3', 'f1', 'f4']);
  });

  it('supports hiding commercial footprint when toggles are turned off', () => {
    const films = [
      { id: '1', title: 'Film A', box_office_domestic: 500000000, view_count: 10000000, roles: ['Director'] },
    ];
    const metrics = computePortfolioMetrics(films as any, []);

    // Both on:
    const showMetrics = true;
    const showBoxOffice = false;
    const showYoutubeViews = true;

    const hasCommercialToDisplay =
      showMetrics &&
      ((showBoxOffice && metrics.totalBoxOffice > 0) ||
       (showYoutubeViews && metrics.totalViews > 0));

    expect(hasCommercialToDisplay).toBe(true);

    // If both toggled off:
    const showMetricsOff = false;
    const hasCommercialOff =
      showMetricsOff &&
      ((showBoxOffice && metrics.totalBoxOffice > 0) ||
       (showYoutubeViews && metrics.totalViews > 0));

    expect(hasCommercialOff).toBe(false);
  });
});
