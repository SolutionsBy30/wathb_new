import { PATH_METADATA, METHOD_METADATA, GUARDS_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { SchoolController } from './school.controller';
import { SchoolAdminController } from './school-admin.controller';
import { SessionGuard } from '../auth/session.guard';

/**
 * SCH — access control on the school surface, asserted rather than assumed.
 *
 * This controller returns other people's children's performance data. The two
 * facts that keep it safe are that every read route carries SessionGuard, and
 * that it demands a 'school' session specifically — not 'supervisor', not
 * 'admin'. Neither is visible to the type checker, and a route added without
 * its guards would simply be public.
 */

const proto = SchoolController.prototype as unknown as Record<string, () => unknown>;
const handlers = Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor');

/** Login cannot require a session — that is the point of it. */
const PUBLIC = ['requestCode', 'verifyCode'];

describe('SchoolController access control', () => {
  it('is mounted under school', () => {
    expect(Reflect.getMetadata(PATH_METADATA, SchoolController)).toBe('school');
  });

  it('guards every route that is not the login pair', () => {
    for (const name of handlers) {
      if (PUBLIC.includes(name)) continue;
      const guards = Reflect.getMetadata(GUARDS_METADATA, proto[name]) ?? [];
      expect({ name, guarded: guards.includes(SessionGuard) }).toEqual({ name, guarded: true });
    }
  });

  it('demands a school session on every guarded route — never supervisor or admin', () => {
    for (const name of handlers) {
      if (PUBLIC.includes(name)) continue;
      expect({ name, kinds: Reflect.getMetadata('sessionKinds', proto[name]) }).toEqual({
        name,
        kinds: ['school'],
      });
    }
  });

  it('leaves the login pair reachable without a session', () => {
    for (const name of PUBLIC) {
      expect(Reflect.getMetadata(GUARDS_METADATA, proto[name])).toBeUndefined();
    }
  });

  it('binds each route to the method it was written for', () => {
    const expected: Record<string, { path: string; method: RequestMethod }> = {
      requestCode: { path: 'auth/otp/request', method: RequestMethod.POST },
      verifyCode: { path: 'auth/otp/verify', method: RequestMethod.POST },
      mySchools: { path: 'me/schools', method: RequestMethod.GET },
      overview: { path: ':schoolId/overview', method: RequestMethod.GET },
      areas: { path: ':schoolId/areas', method: RequestMethod.GET },
      attention: { path: ':schoolId/attention', method: RequestMethod.GET },
    };
    expect(new Set(handlers)).toEqual(new Set(Object.keys(expected)));
    for (const [name, want] of Object.entries(expected)) {
      expect({
        name,
        path: Reflect.getMetadata(PATH_METADATA, proto[name]),
        method: Reflect.getMetadata(METHOD_METADATA, proto[name]),
      }).toEqual({ name, ...want });
    }
  });

  it('declares "me/schools" before the ":schoolId" routes that would swallow it', () => {
    // Same method, same arity: 'me/schools' and ':schoolId/overview' are both
    // two-segment GETs, so declaration order is what keeps 'me' from being
    // read as a school id.
    const gets = handlers
      .map((n) => ({ n, p: Reflect.getMetadata(PATH_METADATA, proto[n]) as string, m: Reflect.getMetadata(METHOD_METADATA, proto[n]) }))
      .filter((r) => r.m === RequestMethod.GET);
    const me = gets.findIndex((r) => r.p === 'me/schools');
    const firstParam = gets.findIndex((r) => r.p.startsWith(':'));
    expect(me).toBeGreaterThanOrEqual(0);
    expect(me).toBeLessThan(firstParam);
  });
});

describe('SchoolAdminController access control', () => {
  it('is admin-only and gated on a real permission', () => {
    expect(Reflect.getMetadata('sessionKinds', SchoolAdminController)).toEqual(['admin']);
    expect(Reflect.getMetadata('adminPermission', SchoolAdminController)).toEqual(['geography']);
    expect(Reflect.getMetadata(GUARDS_METADATA, SchoolAdminController) ?? []).toContain(SessionGuard);
  });
});
