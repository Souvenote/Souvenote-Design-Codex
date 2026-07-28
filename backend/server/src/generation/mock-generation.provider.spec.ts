import { MockGenerationProvider } from './mock-generation.provider';

describe('MockGenerationProvider', () => {
  const provider = new MockGenerationProvider();

  it('returns only the requested assets under a job-specific key', async () => {
    const result = await provider.start({
      generationJobId: 'job-a',
      cardDraftId: 'draft-a',
      creativeBrief: {},
      assetTypes: ['song'],
      referenceImageUrls: [],
    });

    expect(result).toMatchObject({
      status: 'completed',
      result: {
        providerMode: 'mock',
        assets: [
          {
            assetType: 'song',
            source: {
              kind: 'stored',
              storageKey: 'mock/generation/job-a/song.mp3',
            },
          },
        ],
      },
    });
  });
});
