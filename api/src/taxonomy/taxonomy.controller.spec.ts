import { PATH_METADATA, METHOD_METADATA, GUARDS_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { TaxonomyController } from './taxonomy.controller';
import { SessionGuard } from '../auth/session.guard';

/**
 * ADM-094 — access control on the taxonomy surface.
 *
 * SessionGuard is not registered as an APP_GUARD, so a write route that loses
 * its decorators is not "less protected" — it is genuinely public. That has
 * happened here before: `POST admin/tests` shipped without guards and anyone
 * could create a test. Nothing about it is visible to the type checker, so it
 * is asserted instead.
 */
const proto = TaxonomyController.prototype as unknown as Record<string, () => unknown>;
const handlers = Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor');

/** Reference data every picker reads. Deliberately unauthenticated. */
const PUBLIC = ['listTests', 'listGroups', 'tree'];

/** Readable by any admin; gating these on 'taxonomy' broke unrelated screens. */
const ANY_ADMIN = ['listAllTests', 'listAllGroups'];

describe('TaxonomyController access control', () => {
  it('guards every route except the public reference reads', () => {
    for (const name of handlers) {
      if (PUBLIC.includes(name)) continue;
      const guards = Reflect.getMetadata(GUARDS_METADATA, proto[name]) ?? [];
      expect({ name, guarded: guards.includes(SessionGuard) }).toEqual({ name, guarded: true });
    }
  });

  it('leaves only the reference reads reachable without a session', () => {
    for (const name of PUBLIC) {
      expect({ name, guards: Reflect.getMetadata(GUARDS_METADATA, proto[name]) }).toEqual({ name, guards: undefined });
    }
  });

  it('demands an admin session on every guarded route', () => {
    for (const name of handlers) {
      if (PUBLIC.includes(name)) continue;
      expect({ name, kinds: Reflect.getMetadata('sessionKinds', proto[name]) }).toEqual({ name, kinds: ['admin'] });
    }
  });

  it('gates every write on the taxonomy permission', () => {
    // The group routes are writes like any other: creating or deleting a
    // segment reshapes the catalogue every student sees.
    for (const name of handlers) {
      if (PUBLIC.includes(name) || ANY_ADMIN.includes(name)) continue;
      const method = Reflect.getMetadata(METHOD_METADATA, proto[name]);
      if (method === RequestMethod.GET) continue; // reads have their own rules
      expect({ name, perm: Reflect.getMetadata('adminPermission', proto[name]) }).toEqual({
        name,
        perm: ['taxonomy'],
      });
    }
  });

  it('binds the group routes to the methods they were written for', () => {
    // Decorators attach to the *next* method declaration, so a route inserted
    // between a decorator block and its function silently steals it.
    const expected: Record<string, { path: string; method: RequestMethod }> = {
      listGroups: { path: 'test-groups', method: RequestMethod.GET },
      listAllGroups: { path: 'admin/test-groups', method: RequestMethod.GET },
      createGroup: { path: 'admin/test-groups', method: RequestMethod.POST },
      updateGroup: { path: 'admin/test-groups/:id', method: RequestMethod.PATCH },
      deleteGroup: { path: 'admin/test-groups/:id', method: RequestMethod.DELETE },
      // ADM-095 — deleteTest is destructive and testUsage reports what a test
      // holds; a stolen decorator on either is worth catching here.
      updateTest: { path: 'admin/tests/:id', method: RequestMethod.PATCH },
      testUsage: { path: 'admin/tests/:id/usage', method: RequestMethod.GET },
      deleteTest: { path: 'admin/tests/:id', method: RequestMethod.DELETE },
    };
    for (const [name, want] of Object.entries(expected)) {
      expect({
        name,
        path: Reflect.getMetadata(PATH_METADATA, proto[name]),
        method: Reflect.getMetadata(METHOD_METADATA, proto[name]),
      }).toEqual({ name, ...want });
    }
  });

  it('gates the destructive test routes on the taxonomy permission', () => {
    // Called out separately from the blanket rule above: deleting a test
    // cascades its whole taxonomy, so this is the single most damaging route
    // on the controller and should not rely on a loop to be covered.
    for (const name of ['deleteTest', 'updateTest', 'testUsage']) {
      expect({ name, perm: Reflect.getMetadata('adminPermission', proto[name]) }).toEqual({
        name,
        perm: ['taxonomy'],
      });
    }
  });

  it('declares "test-groups" before "tests/:id/tree" cannot swallow it', () => {
    // Both are GETs; 'test-groups' is one segment and 'tests/:id/tree' three,
    // so they cannot collide. The pairing that could is a future 'tests/:id',
    // and this records that the literal comes first.
    const gets = handlers
      .map((n) => ({ n, p: Reflect.getMetadata(PATH_METADATA, proto[n]) as string, m: Reflect.getMetadata(METHOD_METADATA, proto[n]) }))
      .filter((r) => r.m === RequestMethod.GET && !r.p.includes('/'));
    const literals = gets.filter((r) => !r.p.startsWith(':'));
    expect(literals.map((r) => r.p)).toContain('test-groups');
  });
});
