import {
  buildMyCardImagePrompt,
  isBuildMyCardCreativeBrief,
} from './build-my-card-image-prompt';

describe('buildMyCardImagePrompt', () => {
  it('builds a photo transform from intake while using uploads only for likeness', () => {
    const prompt = buildMyCardImagePrompt({
      flow: 'build_my_card',
      basics: {
        orientation: 'landscape',
        occasion: 'Birthday',
        recipient: 'Avery',
        relationship: 'best friend',
      },
      photo: {
        mode: 'upload',
        referenceImageCount: 3,
      },
      image: {
        blueprint: 'transform',
        hasPhoto: true,
        visualStyle: 'watercolor',
        vibes: ['Heartfelt', 'Elegant'],
        vision: 'Place them beside the lake where we learned to canoe.',
        coverMode: 'with',
        coverText: 'Our favourite adventure',
      },
    });

    expect(prompt).toContain('7×5 landscape orientation');
    expect(prompt).toContain('inside a 10% safe zone');
    expect(prompt).toContain(
      'Treat every uploaded photograph as a likeness reference, not as a composition or background reference.',
    );
    expect(prompt).toContain(
      'The first photograph is the primary likeness reference',
    );
    expect(prompt).toContain(
      '"Place them beside the lake where we learned to canoe."',
    );
    expect(prompt).toContain(
      'Generate the cover text as part of the finished image.',
    );
    expect(prompt).toContain(
      'Render the cover text exactly as: "Our favourite adventure".',
    );
    expect(prompt).toContain(
      'Do not invent personal history from a name, occasion, or relationship',
    );
    expect(prompt).not.toContain('Avery');
    expect(prompt).not.toContain('best friend');
  });

  it('keeps the two text-only description fields separate', () => {
    const prompt = buildMyCardImagePrompt({
      flow: 'build_my_card',
      basics: { orientation: 'portrait' },
      photo: {
        mode: 'description',
        description: 'A family of foxes having a moonlit picnic.',
      },
      image: {
        blueprint: 'transform',
        hasPhoto: false,
        visualStyle: 'dreamy',
        vision: 'Add a tiny red thermos as an inside joke.',
        coverMode: 'none',
      },
    });

    expect(prompt).toContain('5×7 portrait orientation');
    expect(prompt).toContain(
      '<user_card_description>"A family of foxes having a moonlit picnic."</user_card_description>',
    );
    expect(prompt).toContain(
      '<user_visual_direction>"Add a tiny red thermos as an inside joke."</user_visual_direction>',
    );
    expect(prompt).toContain(
      'Treat the additional visual direction as a refinement of the core concept',
    );
    expect(prompt).toContain(
      'Do not render any words, letters, numbers, captions, signatures, labels, or pseudo-text',
    );
  });

  it('limits Enhance to composition-preserving artistic restyling', () => {
    const prompt = buildMyCardImagePrompt({
      flow: 'build_my_card',
      basics: { orientation: 'portrait', occasion: 'Anniversary' },
      photo: { mode: 'upload', referenceImageCount: 2 },
      image: {
        blueprint: 'enhance',
        hasPhoto: true,
        visualStyle: 'artistic',
        styleNotes: 'Use soft visible brushwork and warm evening light.',
        accents: ['Hearts', 'Flowers'],
        border: 'Gold foil',
        coverMode: 'with',
        coverText: 'Still us',
      },
    });

    expect(prompt).toContain('FLOW: ENHANCE STYLE');
    expect(prompt).toContain(
      'Preserve the primary photograph’s people, pets, identities, expressions, poses, positions',
    );
    expect(prompt).toContain(
      '"Use soft visible brushwork and warm evening light."',
    );
    expect(prompt).toContain(
      'Do not add decorative accents, borders, or new props.',
    );
    expect(prompt).not.toContain('Gold foil');
    expect(prompt).not.toContain('Hearts');
    expect(prompt).not.toContain('Flowers');
  });

  it('keeps the source photo unchanged in Decorate and infers the surrounding design', () => {
    const prompt = buildMyCardImagePrompt({
      flow: 'build_my_card',
      basics: { orientation: 'portrait', occasion: 'Holiday' },
      photo: { mode: 'upload', referenceImageCount: 4 },
      image: {
        blueprint: 'decorate',
        hasPhoto: true,
        visualStyle: 'minimal',
        vibes: ['Modern'],
        accents: ['Stars/Sparkles'],
        border: 'Minimalist line',
        coverMode: 'with',
        coverText: 'Warmest wishes',
      },
    });

    expect(prompt).toContain('FLOW: DECORATE MY PHOTO');
    expect(prompt).toContain('Keep the primary photograph visually unchanged.');
    expect(prompt).toContain(
      'Do not repaint, redraw, restyle, relight, retouch, smooth, replace, or reinterpret',
    );
    expect(prompt).toContain(
      'Apply this border or design treatment: Minimalist line.',
    );
    expect(prompt).toContain(
      'Add these decorative accents where compositionally appropriate: Stars/Sparkles.',
    );
    expect(prompt).toContain(
      'Use this inferred design direction for borders, accents, and cover typography only:',
    );
    expect(prompt).toContain(
      'Produce the complete flattened card front, not a transparent overlay.',
    );
  });

  it('recognizes both explicit and legacy Build My Card briefs', () => {
    expect(isBuildMyCardCreativeBrief({ flow: 'build_my_card' })).toBe(true);
    expect(
      isBuildMyCardCreativeBrief({ image: { blueprint: 'transform' } }),
    ).toBe(true);
    expect(isBuildMyCardCreativeBrief({ flow: 'personalize_template' })).toBe(
      false,
    );
  });
});
