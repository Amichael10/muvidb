import { describe, expect, it } from 'vitest';
import { generateProfessionalCvPdf } from './professional_cv_pdf.js';

function sample(format: 'resume' | 'detailed', creditCount = 4) {
  return generateProfessionalCvPdf({
    format,
    generatedAt: new Date('2026-08-16T21:00:00.000Z'),
    email: 'actor@example.test',
    professionalRoles: ['actor', 'producer'],
    person: {
      name: 'Ada Example',
      bio: 'Ada Example is an award-winning actor and producer working across African film and television.',
      nationality: 'Nigerian',
      known_for_department: 'Acting',
      slug: 'ada-example',
      youtube_stats: { views: '3200000', subscribers: '84500', videos: '74' },
    },
    credits: Array.from({ length: creditCount }, (_, index) => ({
      role: index % 2 ? 'producer' : 'actor',
      character_name: index % 2 ? null : `Character ${index + 1}`,
      films: {
        title: `Example Film ${index + 1}`,
        year: 2026 - index,
        view_count: 100000 + index * 2500,
        average_rating: 7.5,
        release_type: 'youtube',
        source: 'youtube',
        youtube_watch_url: 'https://youtube.com/watch?v=abcdefghijk',
        box_office_domestic: index === 0 ? 125000000 : null,
        box_office_currency: 'NGN',
        box_office_source: index === 0 ? 'CEAN Official' : null,
      },
    })),
  });
}

describe('professional CV PDF', () => {
  it('builds a downloadable one-page resume with real analytics labels', () => {
    const pdf = sample('resume');
    const content = pdf.toString('ascii');
    expect(content.startsWith('%PDF-1.4')).toBe(true);
    expect(content).toContain('/Type /Pages /Count 1');
    expect(content).toContain('(Ada Example is an award-winning actor and producer working across African film and television.)');
    expect(content).toContain('(YOUTUBE CHANNEL VIEWS)');
    expect(content).toContain('(REPORTED FILM BOX OFFICE)');
    expect(content).not.toContain('(PROFILE VIEWS)');
    expect(content).not.toContain('(CAREER SPAN)');
    expect(content).toContain('(Analytics note: YouTube metrics are synced from the linked channel. Box-office figures are source-backed production totals, not personal earnings.)');
  });

  it('paginates a detailed filmography and includes page numbering', () => {
    const pdf = sample('detailed', 35);
    const content = pdf.toString('ascii');
    expect(content).toMatch(/\/Type \/Pages \/Count [2-9]/);
    expect(content).toContain('(Page 1 of ');
    expect(content).toContain('(Example Film 35)');
  });
});
