import {
  buildPersonalizeTemplateImagePrompt,
  isPersonalizeTemplateCreativeBrief,
} from './personalize-template-image-prompt';

describe('buildPersonalizeTemplateImagePrompt', () => {
  it('keeps the template fixed while using uploaded photos for likeness', () => {
    const prompt = buildPersonalizeTemplateImagePrompt({
      flow: 'personalize_template',
      template: {
        id: 'seek-and-find',
        name: 'Seek-and-Find',
        occasion: 'Birthday',
        description:
          'An original bustling seek-and-find scene with the recipient hidden in the crowd.',
        visualStyleDescription:
          'Dense original storybook line art with a bright celebratory palette.',
        compositionDescription:
          'A crowded full-bleed scene with the recipient placed in the middle distance.',
        lockedElements: ['portrait orientation', 'seek-and-find composition'],
        editableElements: ['subject likeness', 'cover caption'],
        referencePolicy:
          'Use the uploaded photograph only to reproduce the recipient likeness.',
      },
      photo: {
        mode: 'upload',
        referenceImageCount: 2,
      },
      caption: 'Can you find Maya?',
    });

    expect(prompt).toContain('standard 5×7 portrait card');
    expect(prompt).toContain('inside a 10% safe zone');
    expect(prompt).toContain(
      'The reference photograph controls likeness; the template controls the design.',
    );
    expect(prompt).toContain('The template contract is authoritative.');
    expect(prompt).toContain(
      'Generate every listed text slot as part of the finished image',
    );
    expect(prompt).toContain('exact text: "Can you find Maya?"');
    expect(prompt).not.toContain("Where's Waldo");
  });

  it('creates an original subject from the description when no photo is supplied', () => {
    const prompt = buildPersonalizeTemplateImagePrompt({
      flow: 'personalize_template',
      template: {
        id: 'fairy-tale-kids',
        name: 'Fairy Tale for Kids',
        occasion: 'Birthday',
      },
      photo: {
        mode: 'description',
        description:
          'A brave child explorer with curly black hair and a yellow raincoat.',
      },
      caption: 'The bravest explorer',
    });

    expect(prompt).toContain('SUBJECT WITHOUT A REFERENCE PHOTO');
    expect(prompt).toContain(
      '"A brave child explorer with curly black hair and a yellow raincoat."',
    );
    expect(prompt).toContain(
      'Invent all people, animals, props, settings, symbols, costumes, and visual details from scratch.',
    );
  });

  it('uses only backend-verified factual content', () => {
    const prompt = buildPersonalizeTemplateImagePrompt({
      flow: 'personalize_template',
      template: {
        id: 'on-this-day',
        name: 'On This Day',
        occasion: 'Birthday',
        textSlots: [
          {
            role: 'date heading',
            content: 'March 4, 1992',
            placement: 'top',
            maxLines: 1,
          },
        ],
      },
      birthday: '1992-03-04',
      templateData: {
        verified: {
          event: 'The supplied verified historical event.',
        },
      },
      photo: { mode: 'description', description: 'A celebratory city scene.' },
      caption: 'The day you arrived',
    });

    expect(prompt).toContain('User-provided date key: "1992-03-04".');
    expect(prompt).toContain(
      'Backend-verified template data: {"event":"The supplied verified historical event."}',
    );
    expect(prompt).toContain(
      'Never invent historical events, horoscope facts, donation details',
    );
    expect(prompt).toContain('exact text: "March 4, 1992"');
    expect(prompt).toContain('exact text: "The day you arrived"');
  });

  it('renders no text when the template and user supply no text slots', () => {
    const prompt = buildPersonalizeTemplateImagePrompt({
      flow: 'personalize_template',
      template: {
        id: 'outline',
        name: 'Outline',
        occasion: 'Just Because',
      },
      photo: { mode: 'upload', referenceImageCount: 1 },
    });

    expect(prompt).toContain('There are no visible text entries.');
    expect(prompt).toContain(
      'Do not render words, letters, numbers, captions, labels, signs',
    );
  });

  it('recognizes only Personalize a Template briefs', () => {
    expect(
      isPersonalizeTemplateCreativeBrief({ flow: 'personalize_template' }),
    ).toBe(true);
    expect(isPersonalizeTemplateCreativeBrief({ flow: 'build_my_card' })).toBe(
      false,
    );
  });
});
