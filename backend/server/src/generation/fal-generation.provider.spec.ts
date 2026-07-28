import type { FalClient } from '@fal-ai/client';
import { FalGenerationProvider } from './fal-generation.provider';

describe('FalGenerationProvider', () => {
  const submit = jest.fn<
    Promise<{ request_id: string }>,
    [endpointId: string, options: { input: Record<string, unknown> }]
  >();
  const status = jest.fn<
    Promise<{ status: string }>,
    [endpointId: string, options: { requestId: string; logs: boolean }]
  >();
  const result = jest.fn<
    Promise<{ data: unknown }>,
    [endpointId: string, options: { requestId: string }]
  >();
  const cancel = jest.fn<
    Promise<unknown>,
    [endpointId: string, options: { requestId: string }]
  >();
  const client = {
    queue: { submit, status, result, cancel },
  } as unknown as FalClient;
  const provider = new FalGenerationProvider(client);

  beforeEach(() => {
    submit.mockReset();
    status.mockReset();
    result.mockReset();
    cancel.mockReset();
    cancel.mockResolvedValue(undefined);
  });

  it('queues reference-aware image and song jobs without persisting output URLs', async () => {
    submit
      .mockResolvedValueOnce({ request_id: 'image-request' })
      .mockResolvedValueOnce({ request_id: 'song-request' });

    const queued = await provider.start({
      generationJobId: 'job-a',
      cardDraftId: 'draft-a',
      creativeBrief: {
        clientUploadId: 'browser-only-id',
        occasion: 'Birthday',
      },
      assetTypes: ['image', 'song', 'message'],
      referenceImageUrls: ['https://bucket.example/reference.png?signature=1'],
    });

    expect(submit).toHaveBeenCalledTimes(2);
    const calls = submit.mock.calls as unknown as Array<
      [string, { input: Record<string, unknown> }]
    >;
    const [imageEndpoint, imageOptions] = calls[0];
    const [songEndpoint, songOptions] = calls[1];
    expect(imageEndpoint).toBe('openai/gpt-image-2/edit');
    expect(imageOptions.input).toMatchObject({
      image_urls: ['https://bucket.example/reference.png?signature=1'],
      image_size: 'auto',
      output_format: 'png',
    });
    expect(songEndpoint).toBe('fal-ai/lyria3');
    expect(songOptions.input).toHaveProperty('prompt');
    expect(imageOptions.input.prompt).not.toContain('browser-only-id');
    expect(queued).toEqual({
      status: 'queued',
      providerJobRefs: {
        image: {
          endpointId: 'openai/gpt-image-2/edit',
          requestId: 'image-request',
        },
        song: {
          endpointId: 'fal-ai/lyria3',
          requestId: 'song-request',
        },
        message: {
          text: 'Wishing you a day filled with warmth, joy, and memories worth keeping.',
        },
      },
    });
    expect(JSON.stringify(queued)).not.toContain('fal.media');
  });

  it('uses the text-to-image endpoint when no references are present', async () => {
    submit.mockResolvedValue({ request_id: 'image-request' });

    await provider.start({
      generationJobId: 'job-a',
      cardDraftId: 'draft-a',
      creativeBrief: { occasion: 'Birthday' },
      assetTypes: ['image'],
      referenceImageUrls: [],
    });

    expect(submit).toHaveBeenCalledTimes(1);
    const calls = submit.mock.calls as unknown as Array<
      [string, { input: Record<string, unknown> }]
    >;
    const [endpointId, options] = calls[0];
    expect(endpointId).toBe('fal-ai/gpt-image-2');
    expect(options.input).toMatchObject({
      image_size: 'portrait_4_3',
      num_images: 1,
    });
  });

  it('completes a message-only request synchronously', async () => {
    await expect(
      provider.start({
        generationJobId: 'job-a',
        cardDraftId: 'draft-a',
        creativeBrief: { insideMessage: 'You make every day brighter.' },
        assetTypes: ['message'],
        referenceImageUrls: [],
      }),
    ).resolves.toMatchObject({
      status: 'completed',
      result: {
        assets: [
          {
            assetType: 'message',
            source: {
              kind: 'inline',
              data: 'You make every day brighter.',
              contentType: 'text/plain',
            },
          },
        ],
      },
    });

    expect(submit).not.toHaveBeenCalled();
  });

  it('cancels already-submitted jobs when a later submission fails', async () => {
    submit
      .mockResolvedValueOnce({ request_id: 'image-request' })
      .mockRejectedValueOnce(new Error('queue unavailable'));

    await expect(
      provider.start({
        generationJobId: 'job-a',
        cardDraftId: 'draft-a',
        creativeBrief: {},
        assetTypes: ['image', 'song'],
        referenceImageUrls: [],
      }),
    ).rejects.toThrow('queue unavailable');

    expect(cancel).toHaveBeenCalledWith('fal-ai/gpt-image-2', {
      requestId: 'image-request',
    });
  });

  it('keeps the provider job pending until every queue item completes', async () => {
    status
      .mockResolvedValueOnce({ status: 'COMPLETED' })
      .mockResolvedValueOnce({ status: 'IN_PROGRESS' });
    const providerJobRefs = {
      image: {
        endpointId: 'fal-ai/gpt-image-2',
        requestId: 'image-request',
      },
      song: { endpointId: 'fal-ai/lyria3', requestId: 'song-request' },
    };

    await expect(
      provider.poll({
        generationJobId: 'job-a',
        cardDraftId: 'draft-a',
        creativeBrief: {},
        assetTypes: ['image', 'song'],
        referenceImageUrls: [],
        providerJobRefs,
      }),
    ).resolves.toEqual({ status: 'pending', providerJobRefs });

    expect(result).not.toHaveBeenCalled();
  });

  it('maps completed Fal files to remote provider assets', async () => {
    status
      .mockResolvedValueOnce({ status: 'COMPLETED' })
      .mockResolvedValueOnce({ status: 'COMPLETED' });
    result
      .mockResolvedValueOnce({
        data: {
          images: [
            {
              url: 'https://v3b.fal.media/files/card.png',
              content_type: 'image/png',
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          audio: {
            url: 'https://v3b.fal.media/files/song.mp3',
            content_type: 'audio/mpeg',
          },
        },
      });

    await expect(
      provider.poll({
        generationJobId: 'job-a',
        cardDraftId: 'draft-a',
        creativeBrief: {},
        assetTypes: ['image', 'song', 'message'],
        referenceImageUrls: [],
        providerJobRefs: {
          image: {
            endpointId: 'fal-ai/gpt-image-2',
            requestId: 'image-request',
          },
          song: {
            endpointId: 'fal-ai/lyria3',
            requestId: 'song-request',
          },
          message: { text: 'Happy birthday!' },
        },
      }),
    ).resolves.toMatchObject({
      status: 'completed',
      result: {
        providerMode: 'fal',
        assets: [
          {
            assetType: 'image',
            source: {
              kind: 'remote',
              url: 'https://v3b.fal.media/files/card.png',
              contentType: 'image/png',
            },
          },
          {
            assetType: 'song',
            source: {
              kind: 'remote',
              url: 'https://v3b.fal.media/files/song.mp3',
              contentType: 'audio/mpeg',
            },
          },
          {
            assetType: 'message',
            source: { kind: 'inline', data: 'Happy birthday!' },
          },
        ],
      },
    });
  });

  it('rejects incomplete or unapproved persisted provider references', async () => {
    await expect(
      provider.poll({
        generationJobId: 'job-a',
        cardDraftId: 'draft-a',
        creativeBrief: {},
        assetTypes: ['image'],
        referenceImageUrls: [],
        providerJobRefs: {
          image: { endpointId: 'fal-ai/other-model', requestId: 'request-a' },
        },
      }),
    ).resolves.toMatchObject({ status: 'failed' });

    expect(status).not.toHaveBeenCalled();
  });

  it('converts result retrieval errors into a failed provider result', async () => {
    status.mockResolvedValue({ status: 'COMPLETED' });
    result.mockRejectedValue(new Error('generation rejected'));

    await expect(
      provider.poll({
        generationJobId: 'job-a',
        cardDraftId: 'draft-a',
        creativeBrief: {},
        assetTypes: ['image'],
        referenceImageUrls: [],
        providerJobRefs: {
          image: {
            endpointId: 'fal-ai/gpt-image-2',
            requestId: 'image-request',
          },
        },
      }),
    ).resolves.toMatchObject({
      status: 'failed',
      errorMessage: 'fal.ai generation failed: generation rejected',
    });
  });
});
