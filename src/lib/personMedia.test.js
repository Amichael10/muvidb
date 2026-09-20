import { describe, expect, it } from 'vitest';
import {
  formatMediaDuration,
  parseVideoUrl,
  processPersonMedia,
} from './personMedia';

describe('personMedia utilities', () => {
  describe('formatMediaDuration', () => {
    it('formats seconds to MM:SS', () => {
      expect(formatMediaDuration(135)).toBe('2:15');
      expect(formatMediaDuration(45)).toBe('0:45');
      expect(formatMediaDuration(600)).toBe('10:00');
    });

    it('formats longer videos to H:MM:SS', () => {
      expect(formatMediaDuration(3665)).toBe('1:01:05');
    });

    it('handles zero or invalid duration gracefully', () => {
      expect(formatMediaDuration(0)).toBeNull();
      expect(formatMediaDuration(-10)).toBeNull();
      expect(formatMediaDuration(null)).toBeNull();
    });
  });

  describe('parseVideoUrl', () => {
    it('correctly parses standard YouTube URLs', () => {
      const res = parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(res.provider).toBe('youtube');
      expect(res.id).toBe('dQw4w9WgXcQ');
      expect(res.thumbnailUrl).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
      expect(res.embedUrl).toContain('dQw4w9WgXcQ');
    });

    it('correctly parses short youtu.be URLs', () => {
      const res = parseVideoUrl('https://youtu.be/abc123XYZ');
      expect(res.provider).toBe('youtube');
      expect(res.id).toBe('abc123XYZ');
    });

    it('correctly parses Vimeo URLs', () => {
      const res = parseVideoUrl('https://vimeo.com/123456789');
      expect(res.provider).toBe('vimeo');
      expect(res.id).toBe('123456789');
      expect(res.embedUrl).toBe('https://player.vimeo.com/video/123456789?autoplay=1');
    });

    it('falls back to direct video for other URLs', () => {
      const res = parseVideoUrl('https://cdn.muvidb.com/clips/demo.mp4');
      expect(res.provider).toBe('direct');
      expect(res.embedUrl).toBe('https://cdn.muvidb.com/clips/demo.mp4');
    });
  });

  describe('processPersonMedia', () => {
    it('returns empty collections when no media exists', () => {
      const res = processPersonMedia([]);
      expect(res.hasMedia).toBe(false);
      expect(res.videos).toHaveLength(0);
      expect(res.photos).toHaveLength(0);
      expect(res.primaryShowreel).toBeNull();
      expect(res.primaryHeadshot).toBeNull();
    });

    it('segregates videos and photos and filters unapproved items', () => {
      const sampleMedia = [
        { id: '1', media_type: 'video', category: 'showreel', status: 'approved', sort_order: 2 },
        { id: '2', media_type: 'video', category: 'monologue', status: 'approved', is_primary: true, sort_order: 1 },
        { id: '3', media_type: 'photo', category: 'headshot', status: 'approved', sort_order: 1 },
        { id: '4', media_type: 'photo', category: 'production_still', status: 'rejected', sort_order: 2 },
      ];

      const res = processPersonMedia(sampleMedia);
      expect(res.hasMedia).toBe(true);
      expect(res.videos).toHaveLength(2);
      expect(res.photos).toHaveLength(1);
      // Primary item comes first
      expect(res.videos[0].id).toBe('2');
      expect(res.primaryShowreel.id).toBe('2');
      expect(res.primaryHeadshot.id).toBe('3');
    });
  });
});
