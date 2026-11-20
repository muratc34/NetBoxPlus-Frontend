import { unwrap, type StreamingAdminSchemas } from '@netboxplus/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { putInBlocks } from './blocks';
import { useAdminGateway } from './gateway';

export type VideoDetails = StreamingAdminSchemas['VideoDetails'];
export type VideoSummary = StreamingAdminSchemas['VideoSummary'];
export type VideoStatus = StreamingAdminSchemas['VideoStatus'];
export type VideoPurpose = StreamingAdminSchemas['VideoPurpose'];
export type ContentKind = StreamingAdminSchemas['ContentKind'];

/** The languages Streaming takes for audio and subtitles (regional BCP 47 tags), Turkish first. */
export const mediaLanguages = ['tr-TR', 'en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES'] as const;
export type MediaLanguage = (typeof mediaLanguages)[number];

/** A language tag's name in the panel's language ("İngilizce (ABD)"). */
export function languageName(tag: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}

export interface VideoFilters {
  readonly purpose: VideoPurpose | undefined;
  readonly status: VideoStatus | undefined;
  readonly page: number;
}

export const videoKeys = {
  all: ['admin', 'streaming', 'videos'] as const,
  list: (filters: VideoFilters) => ['admin', 'streaming', 'videos', 'list', filters] as const,
  forContent: (contentId: string) => ['admin', 'streaming', 'videos', 'content', contentId] as const,
  video: (id: string) => ['admin', 'streaming', 'videos', 'video', id] as const,
};

/** How many videos a page of the list shows. */
export const videosPageSize = 20;

/** Whether the video is still on its way: uploading or waiting for the transcoder. */
export const isPending = (status: VideoStatus) => status === 'AwaitingUpload' || status === 'Queued';

/** How often a video on its way is asked about again. */
export const videoPollMs = 5000;

/** A page of every video, filtered by purpose and status, newest first. */
export function useVideos(filters: VideoFilters) {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: videoKeys.list(filters),
    queryFn: () =>
      unwrap(
        clients.streaming.GET('/videos', {
          params: {
            query: {
              ...(filters.purpose ? { purpose: filters.purpose } : {}),
              ...(filters.status ? { status: filters.status } : {}),
              page: filters.page,
              pageSize: videosPageSize,
            },
          },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

/** The videos of one movie, episode or series (features and trailers), asked again while one is on its way. */
export function useContentVideos(contentId: string) {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: videoKeys.forContent(contentId),
    queryFn: () =>
      unwrap(clients.streaming.GET('/videos', { params: { query: { contentId, page: 1, pageSize: 100 } } })),
    refetchInterval: (query) =>
      query.state.data?.items.some((video) => isPending(video.status)) ? videoPollMs : false,
  });
}

/** One video with its renditions and tracks, asked again while it is on its way. */
export function useVideo(id: string | undefined) {
  const { clients } = useAdminGateway();
  return useQuery({
    queryKey: videoKeys.video(id ?? ''),
    queryFn: () => unwrap(clients.streaming.GET('/videos/{id}', { params: { path: { id: id ?? '' } } })),
    enabled: id !== undefined,
    refetchInterval: (query) =>
      query.state.data && isPending(query.state.data.status) ? videoPollMs : false,
  });
}

export class VideoRejected extends Error {
  constructor(readonly reason: 'type' | 'empty' | 'size') {
    super(`The video was refused before uploading: ${reason}.`);
  }
}

export interface VideoUpload {
  readonly contentKind: ContentKind;
  readonly contentId: string;
  readonly purpose: VideoPurpose;
  readonly originalAudioLanguage: MediaLanguage;
  readonly file: File;
  readonly onProgress?: (fraction: number) => void;
}

/**
 * Uploads a video for a movie, episode or series and hands it to the transcoder: asks for an upload (a
 * signed address), puts the file there in blocks, then confirms it. Resolves to the video's id. The type
 * is checked first, the size against what the upload takes.
 */
export function useUploadVideo() {
  const { clients, sendBlock } = useAdminGateway();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contentKind,
      contentId,
      purpose,
      originalAudioLanguage,
      file,
      onProgress = () => undefined,
    }: VideoUpload): Promise<string> => {
      if (!file.type.startsWith('video/')) {
        throw new VideoRejected('type');
      }
      if (file.size === 0) {
        throw new VideoRejected('empty');
      }
      const ticket = await unwrap(
        clients.streaming.POST('/videos', {
          body: { contentKind, contentId, purpose, originalAudioLanguage },
        }),
      );
      if (file.size > ticket.maxBytes) {
        throw new VideoRejected('size');
      }
      await putInBlocks(ticket.uploadAddress, file, onProgress, sendBlock);
      await unwrap(
        clients.streaming.POST('/videos/{id}/uploaded', { params: { path: { id: ticket.videoId } } }),
      );
      return ticket.videoId;
    },
    onSettled: (_id, _error, upload) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: videoKeys.forContent(upload.contentId) }),
        queryClient.invalidateQueries({ queryKey: [...videoKeys.all, 'list'] }),
      ]),
  });
}
