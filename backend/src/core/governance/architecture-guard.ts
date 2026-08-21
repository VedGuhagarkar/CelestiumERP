import fs from 'fs';
import path from 'path';

export interface ArchitectureViolation {
  file: string;
  line: number;
  importedModule?: string;
  rule: string;
  description: string;
}

export class ArchitectureGuard {
  private readonly srcDir: string;

  constructor(srcDir?: string) {
    this.srcDir = srcDir || path.resolve(__dirname, '../../');
  }

  /**
   * Recursively get all .ts files in a directory
   */
  private getAllFiles(dir: string, fileList: string[] = []): string[] {
    if (!fs.existsSync(dir)) return fileList;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        this.getAllFiles(fullPath, fileList);
      } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  /**
   * Extract all import statements and their line numbers from a TypeScript source file
   */
  private extractImports(filePath: string): Array<{ line: number; importPath: string; fullStatement: string }> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const imports: Array<{ line: number; importPath: string; fullStatement: string }> = [];

    const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;

    lines.forEach((lineText, idx) => {
      const trimmed = lineText.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        return;
      }

      let match;
      while ((match = importRegex.exec(lineText)) !== null) {
        imports.push({
          line: idx + 1,
          importPath: match[1],
          fullStatement: lineText
        });
      }
    });

    return imports;
  }

  /**
   * Check for direct process.env usage outside the config subsystem
   */
  private checkDirectProcessEnvUsage(filePath: string, normalizedPath: string, violations: ArchitectureViolation[]): void {
    if (normalizedPath.includes('/config/') || normalizedPath.includes('/governance/')) {
      return; // Allowed inside config subsystem and governance scanner
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((lineText, idx) => {
      const trimmed = lineText.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        return;
      }

      if (lineText.includes('process.env')) {
        violations.push({
          file: normalizedPath,
          line: idx + 1,
          rule: 'DIRECT_PROCESS_ENV_PROHIBITED',
          description: "Direct usage of 'process.env' is prohibited outside 'src/config/'. Import 'config' from '@/config/app.config.js' instead."
        });
      }
    });
  }

  /**
   * Scan entire codebase for layer boundary and dependency direction violations
   */
  public audit(): ArchitectureViolation[] {
    const violations: ArchitectureViolation[] = [];
    const files = this.getAllFiles(this.srcDir);

    for (const file of files) {
      const normalizedPath = file.replace(/\\/g, '/');
      const fileName = path.basename(normalizedPath);
      const imports = this.extractImports(file);

      // 0. Configuration Isolation: Prohibit direct process.env access outside src/config/
      this.checkDirectProcessEnvUsage(file, normalizedPath, violations);

      // 1. Controller Boundary Checks
      if (fileName.includes('.controller.')) {
        for (const imp of imports) {
          if (imp.importPath.includes('.repository') || imp.importPath.includes('Repository')) {
            violations.push({
              file: normalizedPath,
              line: imp.line,
              importedModule: imp.importPath,
              rule: 'CONTROLLER_DIRECT_REPOSITORY_PROHIBITED',
              description: 'Controllers MUST NOT import Repositories directly. Call Services instead.'
            });
          }
          if (imp.importPath.includes('.model') || imp.importPath.includes('Model') || imp.importPath === 'mongoose') {
            violations.push({
              file: normalizedPath,
              line: imp.line,
              importedModule: imp.importPath,
              rule: 'CONTROLLER_DIRECT_MODEL_PROHIBITED',
              description: 'Controllers MUST NOT import Models or Mongoose directly. Call Services instead.'
            });
          }
        }
      }

      // 2. Route Boundary Checks
      if (fileName.includes('.routes.') || fileName.includes('.route.')) {
        for (const imp of imports) {
          if (imp.importPath.includes('.service') || imp.importPath.includes('Service')) {
            violations.push({
              file: normalizedPath,
              line: imp.line,
              importedModule: imp.importPath,
              rule: 'ROUTE_DIRECT_SERVICE_PROHIBITED',
              description: 'Routes MUST NOT import Services directly. Routes delegate to Controllers.'
            });
          }
          if (imp.importPath.includes('.repository') || imp.importPath.includes('Repository')) {
            violations.push({
              file: normalizedPath,
              line: imp.line,
              importedModule: imp.importPath,
              rule: 'ROUTE_DIRECT_REPOSITORY_PROHIBITED',
              description: 'Routes MUST NOT import Repositories directly.'
            });
          }
          if (imp.importPath.includes('.model') || imp.importPath.includes('Model') || imp.importPath === 'mongoose') {
            violations.push({
              file: normalizedPath,
              line: imp.line,
              importedModule: imp.importPath,
              rule: 'ROUTE_DIRECT_MODEL_PROHIBITED',
              description: 'Routes MUST NOT import Models or Mongoose directly.'
            });
          }
        }
      }

      // 3. Repository Boundary Checks
      if (fileName.includes('.repository.')) {
        for (const imp of imports) {
          if (imp.importPath.includes('.service') || imp.importPath.includes('Service')) {
            violations.push({
              file: normalizedPath,
              line: imp.line,
              importedModule: imp.importPath,
              rule: 'REPOSITORY_CALL_SERVICE_PROHIBITED',
              description: 'Repositories MUST NOT import Services (Upward dependency violation).'
            });
          }
          if (imp.importPath.includes('.controller') || imp.importPath.includes('Controller')) {
            violations.push({
              file: normalizedPath,
              line: imp.line,
              importedModule: imp.importPath,
              rule: 'REPOSITORY_CALL_CONTROLLER_PROHIBITED',
              description: 'Repositories MUST NOT import Controllers (Upward dependency violation).'
            });
          }
          if (imp.importPath.includes('domain-event-bus') || imp.importPath.includes('eventBus')) {
            violations.push({
              file: normalizedPath,
              line: imp.line,
              importedModule: imp.importPath,
              rule: 'REPOSITORY_EMIT_EVENTS_PROHIBITED',
              description: 'Repositories MUST NOT emit Domain Events directly. Services emit events.'
            });
          }
        }
      }

      // 4. Model Boundary Checks
      if (fileName.includes('.model.') || fileName.includes('.schema.')) {
        for (const imp of imports) {
          if (imp.importPath.includes('.service') || imp.importPath.includes('Service')) {
            violations.push({
              file: normalizedPath,
              line: imp.line,
              importedModule: imp.importPath,
              rule: 'MODEL_IMPORT_SERVICE_PROHIBITED',
              description: 'Models MUST NOT import Services.'
            });
          }
          if (imp.importPath.includes('.repository') || imp.importPath.includes('Repository')) {
            violations.push({
              file: normalizedPath,
              line: imp.line,
              importedModule: imp.importPath,
              rule: 'MODEL_IMPORT_REPOSITORY_PROHIBITED',
              description: 'Models MUST NOT import Repositories.'
            });
          }
        }
      }

      // 5. Service Boundary Checks
      if (fileName.includes('.service.')) {
        for (const imp of imports) {
          if (imp.importPath.includes('.controller') || imp.importPath.includes('Controller')) {
            violations.push({
              file: normalizedPath,
              line: imp.line,
              importedModule: imp.importPath,
              rule: 'SERVICE_CALL_CONTROLLER_PROHIBITED',
              description: 'Services MUST NOT import Controllers (Upward dependency violation).'
            });
          }
          if (
            imp.importPath === 'express' &&
            (imp.fullStatement.includes('Request') || imp.fullStatement.includes('Response') || imp.fullStatement.includes('NextFunction'))
          ) {
            violations.push({
              file: normalizedPath,
              line: imp.line,
              importedModule: imp.importPath,
              rule: 'SERVICE_EXPRESS_LEAKAGE_PROHIBITED',
              description: 'Services MUST NOT import or receive Express Request/Response objects.'
            });
          }
        }
      }

      // 6. Cross-Domain Direct DB Access Checks (inside src/modules/)
      if (normalizedPath.includes('/modules/')) {
        const domainMatch = normalizedPath.match(/\/modules\/([^/]+)\//);
        if (domainMatch) {
          const currentDomain = domainMatch[1];
          for (const imp of imports) {
            const otherDomainRepoMatch = imp.importPath.match(/\/modules\/([^/]+)\/.*(?:\.repository|\.model)/);
            if (otherDomainRepoMatch && otherDomainRepoMatch[1] !== currentDomain) {
              violations.push({
                file: normalizedPath,
                line: imp.line,
                importedModule: imp.importPath,
                rule: 'CROSS_DOMAIN_DIRECT_DATA_ACCESS_PROHIBITED',
                description: `Domain '${currentDomain}' MUST NOT directly import repository/model from domain '${otherDomainRepoMatch[1]}'. Use Domain '${otherDomainRepoMatch[1]}' Service or EventBus.`
              });
            }
          }
        }
      }
    }

    return violations;
  }
}
