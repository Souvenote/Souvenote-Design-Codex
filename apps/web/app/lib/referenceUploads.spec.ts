import {
  getReferenceImageUploads,
  markReferenceImagesUploaded,
  persistableCreativeBrief,
  preserveUploadedReferenceMarkers,
} from './referenceUploads';

const brief = {
  photo: {
    referenceImages: [{ filename: 'family.png', mimeType: 'image/png', size: 123, clientKey: 'pending-one' }],
  },
};

describe('reference upload persistence', () => {
  it('removes browser-only keys and stops completed uploads from being repeated', () => {
    const uploaded = markReferenceImagesUploaded(brief);
    const persisted = persistableCreativeBrief(uploaded);

    expect(persisted).toEqual({
      photo: {
        referenceImages: [{ filename: 'family.png', mimeType: 'image/png', size: 123, uploaded: true }],
      },
    });
    expect(getReferenceImageUploads(persisted)).toEqual([]);
  });

  it('preserves completion on resume without marking a newly selected browser file', () => {
    const uploaded = markReferenceImagesUploaded(brief);
    const resumed = preserveUploadedReferenceMarkers(
      { photo: { referenceImages: [{ filename: 'family.png', mimeType: 'image/png', size: 123 }] } },
      uploaded,
    );
    const replaced = preserveUploadedReferenceMarkers(brief, uploaded);

    expect(getReferenceImageUploads(resumed)).toEqual([]);
    expect(getReferenceImageUploads(replaced)).toHaveLength(1);
  });
});
