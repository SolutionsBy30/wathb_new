import { PATH_METADATA, METHOD_METADATA, GUARDS_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { SimulationStudentController } from './simulation-student.controller';
import { SessionGuard } from '../auth/session.guard';

/**
 * SIM-010 — guard and route wiring for the exam runtime.
 *
 * SessionGuard is not a global APP_GUARD in this app, so a controller that
 * loses @UseGuards is simply public — and this one starts attempts, spends
 * entitlements and writes answers. The route table is pinned per method
 * because a decorator that slides one method down does not fail anywhere else.
 */

const proto = SimulationStudentController.prototype as unknown as Record<string, () => unknown>;
const handlers = Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor');

const routeOf = (name: string) => ({
  path: Reflect.getMetadata(PATH_METADATA, proto[name]) as string,
  method: Reflect.getMetadata(METHOD_METADATA, proto[name]) as RequestMethod,
});

describe('SimulationStudentController wiring', () => {
  it('is mounted under simulation', () => {
    expect(Reflect.getMetadata(PATH_METADATA, SimulationStudentController)).toBe('simulation');
  });

  it('carries SessionGuard at the class level', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, SimulationStudentController) ?? []).toContain(SessionGuard);
  });

  it('requires a student session — never an admin one', () => {
    expect(Reflect.getMetadata('sessionKinds', SimulationStudentController)).toEqual(['student']);
  });

  it('declares no admin permission — this is not an admin surface', () => {
    expect(Reflect.getMetadata('adminPermission', SimulationStudentController)).toBeUndefined();
  });

  it('binds each route to the method it was written for', () => {
    const expected: Record<string, { path: string; method: RequestMethod }> = {
      available: { path: 'available', method: RequestMethod.GET },
      access: { path: 'access/:blueprintId', method: RequestMethod.GET },
      current: { path: 'attempt', method: RequestMethod.GET },
      start: { path: 'attempt/start', method: RequestMethod.POST },
      beginSection: { path: 'attempt/:id/begin-section', method: RequestMethod.POST },
      answer: { path: 'attempt/:id/answer', method: RequestMethod.POST },
      flag: { path: 'attempt/:id/flag', method: RequestMethod.POST },
      submitSection: { path: 'attempt/:id/submit-section', method: RequestMethod.POST },
      event: { path: 'attempt/:id/event', method: RequestMethod.POST },
      abandon: { path: 'attempt/:id/abandon', method: RequestMethod.POST },
    };

    expect(new Set(handlers)).toEqual(new Set(Object.keys(expected)));
    for (const [name, want] of Object.entries(expected)) {
      expect({ name, ...routeOf(name) }).toEqual({ name, ...want });
    }
  });

  it('never lets a param route shadow a literal route declared after it', () => {
    // Only same-method, same-arity paths can collide. Today none do — every
    // ':id' route here is three segments deep and 'attempt/start' is two — but
    // adding an 'attempt/:id' route later would swallow it, and this is what
    // catches that.
    const routes = handlers.map((name) => ({ name, ...routeOf(name) }));

    for (let i = 0; i < routes.length; i++) {
      for (let j = i + 1; j < routes.length; j++) {
        const earlier = routes[i];
        const later = routes[j];
        if (earlier.method !== later.method) continue;
        const a = earlier.path.split('/');
        const b = later.path.split('/');
        if (a.length !== b.length) continue;
        const shadows = a.every((seg, k) => seg === b[k] || seg.startsWith(':'));
        expect({ earlier: earlier.name, later: later.name, shadows }).toEqual({
          earlier: earlier.name,
          later: later.name,
          shadows: false,
        });
      }
    }
  });
});
