import { QuestionsService } from './questions.service';
import { UpdateQuestionContentDto } from './dto/questions.dto';

/**
 * ADM-100 — editing a question must persist the fields that live on the
 * question row, not just the new version's wording.
 *
 * This shipped broken: `createNewVersion` wrote only currentVersionId,
 * stemHash, difficulty and timeLimitS, so re-classifying a question to a
 * different section/area/label saved successfully and changed nothing. The
 * admin's dropdown moved, the request returned 200, and the question stayed
 * where it was.
 *
 * Nothing typechecks that a field is present in a Prisma `data` object, and
 * nothing throws when one is missing — so the only way to catch it is to
 * assert on the payload. Prisma is stubbed; this is about the shape of the
 * write, not the database.
 */
describe('QuestionsService.createNewVersion', () => {
  const dto: UpdateQuestionContentDto = {
    labelId: 'label-geometry',
    difficulty: 4,
    timeLimitS: 90,
    stem: 'ما محيط الدائرة؟',
    options: [
      { key: 'أ', text: '2πr' },
      { key: 'ب', text: 'πr²' },
    ],
    correctKey: 'أ',
    explanation: 'المحيط = 2πr',
    source: 'قياس 1445',
  };

  function build() {
    const updates: { where: unknown; data: Record<string, unknown> }[] = [];
    const prisma = {
      question: {
        findUnique: async () => ({
          id: 'q1',
          labelId: 'label-algebra',
          versions: [{ version: 3 }],
        }),
        update: async (args: { where: unknown; data: Record<string, unknown> }) => {
          updates.push(args);
          return { id: 'q1', ...args.data };
        },
      },
      questionVersion: {
        create: async () => ({ id: 'v4', version: 4 }),
      },
    };
    const service = new QuestionsService(prisma as never, { record: async () => {} } as never);
    return { service, updates };
  }

  it('moves the question to the label the editor chose', async () => {
    const { service, updates } = build();
    await service.createNewVersion('q1', dto, 'admin-1');
    expect(updates).toHaveLength(1);
    expect(updates[0].data.labelId).toBe('label-geometry');
  });

  it('persists every question-level field the editor can change', async () => {
    const { service, updates } = build();
    await service.createNewVersion('q1', dto, 'admin-1');
    expect(updates[0].data).toMatchObject({
      labelId: 'label-geometry',
      difficulty: 4,
      timeLimitS: 90,
      source: 'قياس 1445',
      currentVersionId: 'v4',
    });
  });

  it('leaves an omitted optional field untouched rather than nulling it', async () => {
    // Prisma treats undefined as "do not write this column"; the editor does
    // not manage passages, so an edit must not detach one.
    const { service, updates } = build();
    await service.createNewVersion('q1', { ...dto, passageId: undefined }, 'admin-1');
    expect(updates[0].data.passageId).toBeUndefined();
  });

  it('points the question at the newly created version', async () => {
    const { service, updates } = build();
    await service.createNewVersion('q1', dto, 'admin-1');
    expect(updates[0].data.currentVersionId).toBe('v4');
  });

  it('refuses a correctKey that matches none of the options', async () => {
    const { service } = build();
    await expect(
      service.createNewVersion('q1', { ...dto, correctKey: 'ز' }, 'admin-1'),
    ).rejects.toThrow();
  });
});
