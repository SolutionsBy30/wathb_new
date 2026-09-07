import { PATH_METADATA, METHOD_METADATA, GUARDS_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { SimulationAdminController } from './simulation-admin.controller';
import { SessionGuard } from '../auth/session.guard';
import { ADMIN_PERMISSIONS } from '../admin-ops/admin-permissions';

/**
 * SIM-006 — guard and route wiring, asserted rather than assumed.
 *
 * This project has already shipped one security regression of exactly this
 * shape: a route inserted between a decorator block and its method moved the
 * decorator onto the wrong handler, and nothing failed until it was noticed by
 * hand. SessionGuard is not a global APP_GUARD here, so an admin controller
 * that loses its @UseGuards is simply public.
 *
 * These are cheap reflection checks with no database, and they fail loudly the
 * next time someone edits this controller.
 */

const proto = SimulationAdminController.prototype as unknown as Record<string, () => unknown>;
const handlers = Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor');

const routeOf = (name: string) => ({
  path: Reflect.getMetadata(PATH_METADATA, proto[name]) as string,
  method: Reflect.getMetadata(METHOD_METADATA, proto[name]) as RequestMethod,
});

describe('SimulationAdminController wiring', () => {
  it('is mounted under admin/simulation', () => {
    expect(Reflect.getMetadata(PATH_METADATA, SimulationAdminController)).toBe('admin/simulation');
  });

  it('carries SessionGuard at the class level', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SimulationAdminController) ?? [];
    expect(guards).toContain(SessionGuard);
  });

  it('requires an admin session for the whole controller', () => {
    expect(Reflect.getMetadata('sessionKinds', SimulationAdminController)).toEqual(['admin']);
  });

  it('gates the whole controller on a real permission key', () => {
    const perms = Reflect.getMetadata('adminPermission', SimulationAdminController);
    expect(perms).toEqual(['simulations']);
    expect(ADMIN_PERMISSIONS).toContain('simulations');
  });

  it('leaves no handler without a route — a decorator that slid onto the wrong method', () => {
    for (const name of handlers) {
      expect({ name, path: Reflect.getMetadata(PATH_METADATA, proto[name]) }).toEqual({
        name,
        path: expect.any(String),
      });
    }
  });

  it('binds each route to the method it was written for', () => {
    // Spelled out rather than derived, so a decorator sliding one method down
    // changes this table and fails, instead of moving silently with the code.
    const expected: Record<string, { path: string; method: RequestMethod }> = {
      listBlueprints: { path: 'blueprints', method: RequestMethod.GET },
      createBlueprint: { path: 'blueprints', method: RequestMethod.POST },
      getBlueprint: { path: 'blueprints/:id', method: RequestMethod.GET },
      validateBlueprint: { path: 'blueprints/:id/validate', method: RequestMethod.GET },
      readiness: { path: 'blueprints/:id/readiness', method: RequestMethod.GET },
      listForms: { path: 'blueprints/:id/forms', method: RequestMethod.GET },
      updateBlueprint: { path: 'blueprints/:id', method: RequestMethod.POST },
      saveSections: { path: 'blueprints/:id/sections', method: RequestMethod.POST },
      cloneBlueprint: { path: 'blueprints/:id/clone', method: RequestMethod.POST },
      setBlueprintStatus: { path: 'blueprints/:id/status', method: RequestMethod.POST },
      generateForm: { path: 'blueprints/:id/forms', method: RequestMethod.POST },
      deleteBlueprint: { path: 'blueprints/:id', method: RequestMethod.DELETE },
      getForm: { path: 'forms/:formId', method: RequestMethod.GET },
      setFormStatus: { path: 'forms/:formId/status', method: RequestMethod.POST },
      deleteForm: { path: 'forms/:formId', method: RequestMethod.DELETE },
      regenerateItem: { path: 'form-items/:itemId/regenerate', method: RequestMethod.POST },
    };

    expect(new Set(handlers)).toEqual(new Set(Object.keys(expected)));
    for (const [name, want] of Object.entries(expected)) {
      expect({ name, ...routeOf(name) }).toEqual({ name, ...want });
    }
  });

  it('never lets a param route shadow a literal route declared after it', () => {
    // Nest matches in declaration order, and only routes with the same method
    // and the same segment count can collide at all — 'blueprints/:id' cannot
    // capture 'blueprints/:id/validate', but it would capture a later
    // 'blueprints/summary'. That is the shape this guards against.
    const routes = handlers.map((name) => ({ name, ...routeOf(name) }));

    for (let i = 0; i < routes.length; i++) {
      for (let j = i + 1; j < routes.length; j++) {
        const earlier = routes[i];
        const later = routes[j];
        if (earlier.method !== later.method) continue;

        const a = earlier.path.split('/');
        const b = later.path.split('/');
        if (a.length !== b.length) continue;

        // The earlier route captures the later one when every segment either
        // matches exactly or is a parameter in the earlier path.
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
