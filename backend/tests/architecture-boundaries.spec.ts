import path from 'path';
import { ArchitectureGuard } from '../src/core/governance/architecture-guard.js';

describe('Architecture Boundary & Layer Dependency Enforcement (check:arch)', () => {
  const guard = new ArchitectureGuard(path.resolve(__dirname, '../src'));

  it('should verify 100% strict layer boundary compliance across all backend source files', () => {
    const violations = guard.audit();

    if (violations.length > 0) {
      console.error('❌ Architectural Boundary Violations Detected:');
      violations.forEach((v) => {
        console.error(`  - [${v.rule}] ${v.file}:${v.line}`);
        console.error(`    Import: ${v.importedModule}`);
        console.error(`    Details: ${v.description}\n`);
      });
    }

    expect(violations).toEqual([]);
  });

  it('should enforce that Controllers never import Mongoose or Repositories directly', () => {
    const violations = guard.audit().filter((v) =>
      v.rule === 'CONTROLLER_DIRECT_REPOSITORY_PROHIBITED' ||
      v.rule === 'CONTROLLER_DIRECT_MODEL_PROHIBITED'
    );
    expect(violations).toHaveLength(0);
  });

  it('should enforce that Routes never import Services, Repositories, or Models', () => {
    const violations = guard.audit().filter((v) =>
      v.rule === 'ROUTE_DIRECT_SERVICE_PROHIBITED' ||
      v.rule === 'ROUTE_DIRECT_REPOSITORY_PROHIBITED' ||
      v.rule === 'ROUTE_DIRECT_MODEL_PROHIBITED'
    );
    expect(violations).toHaveLength(0);
  });

  it('should enforce that Repositories never import Services, Controllers, or DomainEventBus', () => {
    const violations = guard.audit().filter((v) =>
      v.rule === 'REPOSITORY_CALL_SERVICE_PROHIBITED' ||
      v.rule === 'REPOSITORY_CALL_CONTROLLER_PROHIBITED' ||
      v.rule === 'REPOSITORY_EMIT_EVENTS_PROHIBITED'
    );
    expect(violations).toHaveLength(0);
  });

  it('should enforce that Services never import Controllers or Express Request/Response objects', () => {
    const violations = guard.audit().filter((v) =>
      v.rule === 'SERVICE_CALL_CONTROLLER_PROHIBITED' ||
      v.rule === 'SERVICE_EXPRESS_LEAKAGE_PROHIBITED'
    );
    expect(violations).toHaveLength(0);
  });
});
