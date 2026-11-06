import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@react-email/render';
import MuviDbContributionThankYouEmail from './MuviDbContributionThankYouEmail.generated.js';

const mockState = vi.hoisted(() => ({
  authenticated: true,
  role: 'admin',
  pendingCount: 0,
  contributions: [] as any[],
  user: { id: 'user-123', name: 'Chioma Adebayo', email: 'chioma@example.com' },
  sentEmails: [] as any[],
  updatedPayloads: [] as any[],
}));

const getUserMock = vi.hoisted(() => vi.fn());
const sendContributionThankYouEmailMock = vi.hoisted(() => vi.fn());

vi.mock('./supabase.js', () => {
  const from = vi.fn((table: string) => {
    const chain: any = {
      select: vi.fn((cols: string, opts?: any) => {
        if (opts?.count === 'exact' && opts?.head === true) {
          return {
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ count: mockState.pendingCount, error: null })),
            })),
          };
        }
        return chain;
      }),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => {
        if (table === 'users') {
          return { data: { role: mockState.role, name: mockState.user.name, email: mockState.user.email }, error: null };
        }
        if (table === 'contributions') {
          const found = mockState.contributions[0];
          return { data: found || null, error: null };
        }
        if (table === 'films') {
          return { data: { title: 'The Black Book', year: 2023, slug: 'the-black-book' }, error: null };
        }
        return { data: null, error: null };
      }),
      single: vi.fn(async () => {
        if (table === 'users') return { data: mockState.user, error: null };
        return { data: null, error: null };
      }),
      update: vi.fn((patch: any) => ({
        eq: vi.fn(async (col: string, val: any) => {
          mockState.updatedPayloads.push({ col, val, patch });
          return { error: null };
        }),
      })),
      then: (resolve: (val: any) => void) => {
        if (table === 'contributions') {
          resolve({ data: mockState.contributions, error: null });
        } else {
          resolve({ data: [], error: null });
        }
      },
    };
    return chain;
  });

  return {
    getSupabase: () => ({
      auth: { getUser: getUserMock },
      from,
    }),
  };
});

vi.mock('./contribution_email.js', () => ({
  sendContributionThankYouEmail: sendContributionThankYouEmailMock,
}));

describe('MuviDbContributionThankYouEmail Template', () => {
  it('renders official brand logo from /brand folder and has no gradient buttons', async () => {
    const html = await render(
      React.createElement(MuviDbContributionThankYouEmail, {
        contributorName: 'Chioma',
        itemTitle: 'The Black Book (2023)',
        contributionType: 'poster',
        detailsSummary: 'Official high-resolution poster added.',
      }),
    );

    // Verify logo from /brand
    expect(html).toContain('https://muvidb.com/brand/wordmark-dark.png');
    // Verify no gradient buttons
    expect(html).not.toContain('linear-gradient');
    // Verify solid MuviDB brand orange
    expect(html).toContain('#FF5A1F');
    // Verify recipient name & title
    expect(html).toContain('Chioma');
    expect(html).toContain('The Black Book (2023)');
    expect(html).toContain('Verified &amp; Live in Database');
  });

  it('renders consolidated multi-item stack when user has multiple approved contributions', async () => {
    const html = await render(
      React.createElement(MuviDbContributionThankYouEmail, {
        contributorName: 'Babatunde',
        items: [
          {
            itemTitle: 'The Black Book (2023)',
            contributionType: 'poster',
            detailsSummary: 'Official cinema poster updated.',
            itemUrl: 'https://muvidb.com/film/the-black-book',
          },
          {
            itemTitle: 'Anikulapo (2022)',
            contributionType: 'credits',
            detailsSummary: 'Added missing lead cast credit for Lateef Adedimeji.',
            itemUrl: 'https://muvidb.com/film/anikulapo',
          },
          {
            itemTitle: 'Jagun Jagun (2023)',
            contributionType: 'synopsis',
            detailsSummary: 'Corrected official synopsis and logline.',
            itemUrl: 'https://muvidb.com/film/jagun-jagun',
          },
        ],
      }),
    );

    expect(html).toContain('Thank you for your contributions, Babatunde!');
    expect(html).toContain('3 contributions verified and now live on MuviDB!');
    expect(html).toContain('The Black Book (2023)');
    expect(html).toContain('Anikulapo (2022)');
    expect(html).toContain('Jagun Jagun (2023)');
    expect(html).toContain('Contribution #1');
    expect(html).toContain('Contribution #2');
    expect(html).toContain('Contribution #3');
    expect(html).toContain('https://muvidb.com/brand/wordmark-dark.png');
  });
});

describe('handleContributionNotifications endpoint', () => {
  beforeEach(() => {
    mockState.authenticated = true;
    mockState.role = 'admin';
    mockState.pendingCount = 0;
    mockState.contributions = [];
    mockState.updatedPayloads = [];
    getUserMock.mockReset();
    sendContributionThankYouEmailMock.mockReset();

    getUserMock.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null,
    });

    sendContributionThankYouEmailMock.mockResolvedValue({
      ok: true,
      emailId: 'mock-resend-id-123',
    });
  });

  it('holds email notification when contributor still has pending contributions in review', async () => {
    const { handleContributionNotifications } = await import('./contribution_notification_handler.js');

    mockState.pendingCount = 2; // User has 2 other pending contributions
    mockState.contributions = [
      {
        id: 'contrib-1',
        submitted_by: 'user-123',
        status: 'approved',
        target_table: 'films',
        target_id: 'film-1',
        payload: { fields: { poster: 'new.jpg' } },
      },
    ];

    const req: any = {
      method: 'POST',
      headers: { authorization: 'Bearer test-admin-token' },
      body: { action: 'on-contribution-reviewed', contributionId: 'contrib-1' },
    };

    let responseStatus = 200;
    let responseJson: any = null;
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn((s) => {
        responseStatus = s;
        return res;
      }),
      json: vi.fn((j) => {
        responseJson = j;
        return res;
      }),
      end: vi.fn(),
    };

    await handleContributionNotifications(req, res);

    expect(responseStatus).toBe(200);
    expect(responseJson.status).toBe('held');
    expect(responseJson.remainingPending).toBe(2);
    // Verified: No email sent while pending contributions remain!
    expect(sendContributionThankYouEmailMock).not.toHaveBeenCalled();
  });

  it('dispatches consolidated thank you email and stamps records when pending count reaches 0', async () => {
    const { handleContributionNotifications } = await import('./contribution_notification_handler.js');

    mockState.pendingCount = 0; // Queue cleared!
    mockState.contributions = [
      {
        id: 'contrib-1',
        submitted_by: 'user-123',
        status: 'approved',
        target_table: 'films',
        target_id: 'film-1',
        payload: { fields: { poster: 'new.jpg' } }, // un-notified
      },
    ];

    const req: any = {
      method: 'POST',
      headers: { authorization: 'Bearer test-admin-token' },
      body: { action: 'on-contribution-reviewed', contributionId: 'contrib-1' },
    };

    let responseStatus = 200;
    let responseJson: any = null;
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn((s) => {
        responseStatus = s;
        return res;
      }),
      json: vi.fn((j) => {
        responseJson = j;
        return res;
      }),
      end: vi.fn(),
    };

    await handleContributionNotifications(req, res);

    expect(responseStatus).toBe(200);
    expect(responseJson.status).toBe('sent');
    expect(responseJson.recipient).toBe('chioma@example.com');
    expect(sendContributionThankYouEmailMock).toHaveBeenCalledTimes(1);

    // Stamped with thank_you_emailed_at and thank_you_email_id
    expect(mockState.updatedPayloads.length).toBeGreaterThan(0);
    expect(mockState.updatedPayloads[0].patch.payload.thank_you_email_id).toBe('mock-resend-id-123');
  });
});
