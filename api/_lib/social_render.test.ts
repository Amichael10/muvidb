import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { ASSET_FORMAT_DIMENSIONS, imageSize } from './social_render.js';

function pngOf(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ihdr, deflateSync(Buffer.alloc(4))]);
}

function jpegOf(width: number, height: number): Buffer {
  // SOI, a JFIF APP0 segment to skip over, then SOF0 carrying the dimensions.
  const app0 = Buffer.concat([Buffer.from([0xff, 0xe0, 0x00, 0x10]), Buffer.alloc(14)]);
  const sof = Buffer.alloc(11);
  sof.writeUInt16BE(0xffc0, 0);
  sof.writeUInt16BE(8, 2);
  sof.writeUInt8(8, 4);
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.alloc(16)]);
}

describe('imageSize', () => {
  it('reads PNG dimensions from IHDR', () => {
    expect(imageSize(pngOf(1280, 720))).toEqual({ width: 1280, height: 720 });
  });

  it('reads JPEG dimensions past an APP0 segment', () => {
    expect(imageSize(jpegOf(480, 360))).toEqual({ width: 480, height: 360 });
  });

  it('reads GIF dimensions', () => {
    const gif = Buffer.alloc(32);
    gif.write('GIF89a', 0, 'ascii');
    gif.writeUInt16LE(300, 6);
    gif.writeUInt16LE(200, 8);
    expect(imageSize(gif)).toEqual({ width: 300, height: 200 });
  });

  it('returns null for a buffer that is not an image', () => {
    expect(imageSize(Buffer.from('this is definitely not an image at all'))).toBeNull();
  });

  it('returns null for a truncated buffer instead of throwing', () => {
    expect(imageSize(Buffer.from([0x89, 0x50]))).toBeNull();
  });
});

describe('ASSET_FORMAT_DIMENSIONS', () => {
  it('matches the aspect ratio each format name promises', () => {
    const { portrait_4_5, square_1_1, vertical_9_16 } = ASSET_FORMAT_DIMENSIONS;
    expect(portrait_4_5.width / portrait_4_5.height).toBeCloseTo(4 / 5, 3);
    expect(square_1_1.width / square_1_1.height).toBeCloseTo(1, 3);
    expect(vertical_9_16.width / vertical_9_16.height).toBeCloseTo(9 / 16, 3);
  });
});

describe('renderSnapshotAsset', () => {
  it('renders a movie spotlight card into a valid PNG buffer', async () => {
    const { renderSnapshotAsset } = await import('./social_render.js');
    const result = await renderSnapshotAsset({
      snapshot: {
        kind: 'upcoming_movie',
        capturedAt: '2026-08-22T00:00:00Z',
        filmId: 'test-film-1',
        title: 'Delivery Boy',
        slug: 'delivery-boy',
        posterUrl: null,
        backdropUrl: null,
        releaseDate: '2024-05-10',
        watchAvailability: 'Streaming on Circuits',
        year: 2024,
        synopsis: 'A runaway teen escapes an extremist camp across northern Nigeria.',
        tagline: 'Freedom comes with a price.',
        genres: ['Drama', 'Thriller'],
        countries: ['Nigeria'],
        languages: ['English', 'Hausa'],
        likedPercent: 84,
        comingSoon: false,
        isPublished: true,
        topCast: [
          { personId: 'p1', name: 'Jemima Osunde', handle: '@jemimaosunde', character: 'Nkem' },
          { personId: 'p2', name: 'Jammal Ibrahim', handle: null, character: 'Amir' },
        ],
      },
      format: 'portrait_4_5',
    });

    expect(result.format).toBe('portrait_4_5');
    expect(result.width).toBe(1080);
    expect(result.height).toBe(1350);
    expect(result.png).toBeInstanceOf(Buffer);
    expect(result.png.length).toBeGreaterThan(1000);
  }, 15_000);

  it('renders an actor spotlight card into a valid square PNG buffer', async () => {
    const { renderSnapshotAsset } = await import('./social_render.js');
    const result = await renderSnapshotAsset({
      snapshot: {
        kind: 'actor_spotlight',
        capturedAt: '2026-08-22T00:00:00Z',
        personId: 'test-person-1',
        name: 'Bisola Aiyeola',
        handle: '@iambisola',
        slug: 'bisola-aiyeola',
        photoUrl: null,
        photoCutoutUrl: null,
        nationality: 'Nigerian',
        knownForDepartment: 'Actor & Producer',
        bio: 'Award-winning Nigerian actress and singer with prominent Nollywood roles.',
        knownFor: [
          { filmId: 'f1', title: 'Sugar Rush', slug: 'sugar-rush', year: 2019, posterUrl: null, character: 'Bola' },
          { filmId: 'f2', title: 'Breaded Life', slug: 'breaded-life', year: 2021, posterUrl: null, character: 'Todowede' },
        ],
        creditCount: 18,
      },
      format: 'square_1_1',
    });

    expect(result.format).toBe('square_1_1');
    expect(result.width).toBe(1080);
    expect(result.height).toBe(1080);
    expect(result.png).toBeInstanceOf(Buffer);
    expect(result.png.length).toBeGreaterThan(1000);
  }, 15_000);
});
