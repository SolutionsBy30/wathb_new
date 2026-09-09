import { QuestionsService } from './questions.service';

/**
 * ADM-101 — bulk re-filing.
 *
 * The guards matter more than the happy path here. This is the one bulk action
 * with no undo in the console: status can be set back, but a move overwrites
 * the only record of where each question was. So the destination is validated,
 * a retired label is refused, and the previous labelId of every question goes
 * into the audit entry.
 *
 * Prisma is stubbed — this is about which writes happen and what gets logged,
 * not about the database.
 */
describe('QuestionsService.bulkSetLabel', () => {
  const geometry = {
    id: 'label-geometry',
    nameAr: 'الهندسة',
    isRetired: false,
    area: { nameAr: 'الرياضيات', section: { nameAr: 'كمي', test: { nameAr: 'القدرات' } } },
  };

  function build(label: unknown = geometry) {
    const updates: { where: unknown; data: unknown }[] = [];
    const audits: Record<string, unknown>[] = [];
    const prisma = {
      label: { findUnique: async () => label },
      question: {
        findMany: async () => [
          { id: 'q1', labelId: 'label-algebra' },
          { id: 'q2', labelId: 'label-reading' },
        ],
        updateMany: async (args: { where: unknown; data: unknown }) => {
          updates.push(args);
          return { count: 2 };
        },
      },
      user: { findUnique: async () => ({ name: 'Admin', email: 'admin@wathb.tech' }) },
    };
    const audit = { record: async (e: Record<string, unknown>) => { audits.push(e); } };
    const service = new QuestionsService(prisma as never, audit as never);
    return { service, updates, audits };
  }

  it('writes the new label onto every selected question in one update', async () => {
    const { service, updates } = build();
    const res = await service.bulkSetLabel(['q1', 'q2'], 'label-geometry', 'admin-1');
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ where: { id: { in: ['q1', 'q2'] } }, data: { labelId: 'label-geometry' } });
    expect(res.moved).toBe(2);
  });

  it('reports the destination so the console can name it back', async () => {
    const { service } = build();
    const res = await service.bulkSetLabel(['q1'], 'label-geometry', 'admin-1');
    expect(res.destination).toEqual({
      testNameAr: 'القدرات',
      sectionNameAr: 'كمي',
      areaNameAr: 'الرياضيات',
      labelNameAr: 'الهندسة',
    });
  });

  it('records where each question came from, so a wrong move can be undone', async () => {
    const { service, audits } = build();
    await service.bulkSetLabel(['q1', 'q2'], 'label-geometry', 'admin-1');
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe('question.bulk_move');
    expect(audits[0].before).toEqual([
      { id: 'q1', labelId: 'label-algebra' },
      { id: 'q2', labelId: 'label-reading' },
    ]);
    expect(audits[0].actorId).toBe('admin-1');
  });

  it('refuses a label that does not exist, without writing anything', async () => {
    const { service, updates } = build(null);
    await expect(service.bulkSetLabel(['q1'], 'nope', 'admin-1')).rejects.toThrow();
    expect(updates).toHaveLength(0);
  });

  it('refuses a retired label — it would silently pull the questions out of circulation', async () => {
    const { service, updates } = build({ ...geometry, isRetired: true });
    await expect(service.bulkSetLabel(['q1'], 'label-geometry', 'admin-1')).rejects.toThrow();
    expect(updates).toHaveLength(0);
  });

  it('refuses when none of the ids match a question', async () => {
    const { service, updates } = build();
    // Overriding findMany to return nothing: a selection that resolves to zero
    // rows means the ids are stale, and updateMany would silently succeed.
    (service as never as { prisma: { question: { findMany: () => Promise<unknown[]> } } }).prisma.question.findMany =
      async () => [];
    await expect(service.bulkSetLabel(['gone'], 'label-geometry', 'admin-1')).rejects.toThrow();
    expect(updates).toHaveLength(0);
  });
});
