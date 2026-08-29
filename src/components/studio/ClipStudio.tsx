import React, { useState } from 'react';
import toast from 'react-hot-toast';

export interface ClipMetadata {
  start: number;
  end: number;
  title?: string;
  sourceUrl?: string;
}

export interface MediaDraftItem {
  id: string;
  type: 'video' | 'image';
  url: string;
  blob?: Blob;
  duration?: number;
  aspectRatio?: string;
}

interface ClipStudioProps {
  onSendToCanvas?: (mediaItem: MediaDraftItem) => void;
  opencut?: {
    exportClip: (options: {
      startTime: number;
      endTime: number;
      format?: string;
      quality?: string;
    }) => Promise<Blob>;
  };
}

export function ClipStudio({ onSendToCanvas, opencut }: ClipStudioProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [availableMedia, setAvailableMedia] = useState<MediaDraftItem[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState<number>(0);

  async function handleSendClipToCanvas(clipMetadata: ClipMetadata) {
    try {
      setIsProcessing(true);
      
      let exportedBlob: Blob | null = null;
      let playableBlobUrl: string = clipMetadata.sourceUrl || '';

      // 1. Export the trimmed section into a clean WebM (with Opus sound) or MP4 blob
      if (opencut && typeof opencut.exportClip === 'function') {
        exportedBlob = await opencut.exportClip({
          startTime: clipMetadata.start,
          endTime: clipMetadata.end,
          format: 'webm', // WebM reliably includes audio across all browsers
          quality: 'high',
        });
        // 2. Create a playable local object URL from the compiled blob
        playableBlobUrl = URL.createObjectURL(exportedBlob);
      } else if (clipMetadata.sourceUrl?.startsWith('blob:')) {
        playableBlobUrl = clipMetadata.sourceUrl;
      }

      const newMediaItem: MediaDraftItem = {
        id: `clip_${Date.now()}`,
        type: 'video',
        url: playableBlobUrl,
        blob: exportedBlob || undefined,
        duration: clipMetadata.end - clipMetadata.start,
        aspectRatio: '9:16',
      };

      // 3. Update the Canvas Active Draft state
      setAvailableMedia((prev) => [newMediaItem, ...prev]);
      setActiveMediaIndex(0);
      onSendToCanvas?.(newMediaItem);
      
      toast.success('Clip successfully processed & sent to Instagram Canvas!');
    } catch (error) {
      console.error('Failed to export clip to canvas:', error);
      toast.error('Failed to process clip. Please verify the video format.');
    } finally {
      setIsProcessing(false);
    }
  }

  return {
    isProcessing,
    availableMedia,
    activeMediaIndex,
    handleSendClipToCanvas,
  };
}

export default ClipStudio;
