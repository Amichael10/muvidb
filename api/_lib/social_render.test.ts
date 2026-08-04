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
