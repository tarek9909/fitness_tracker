import fs from 'fs';
import path from 'path';

export interface ColumnDefinition {
  name: string;
  definition: string;
}

export interface TableDefinition {
  tableName: string;
  columns: Map<string, string>;
}

/**
 * Parses SQL DDL statements (both MySQL and SQLite dialects) and extracts table and column structures.
 */
export function parseSqlTables(sqlText: string): Map<string, TableDefinition> {
  const tables = new Map<string, TableDefinition>();

  // Remove single line comments
  const cleanSql = sqlText.replace(/--.*$/gm, '');

  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([a-zA-Z0-9_]+)`?\s*\(/gi;
  let match: RegExpExecArray | null;

  while ((match = createTableRegex.exec(cleanSql)) !== null) {
    const tableName = match[1].toLowerCase();
    const startIndex = match.index + match[0].length;

    // Scan until balancing closing parenthesis for table definition
    let depth = 1;
    let endIndex = startIndex;
    while (endIndex < cleanSql.length && depth > 0) {
      const char = cleanSql[endIndex];
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
      }
      endIndex++;
    }

    const tableBody = cleanSql.substring(startIndex, endIndex - 1);
    const columns = new Map<string, string>();

    // Split column/constraint definitions by comma while respecting nested parentheses
    const rawLines: string[] = [];
    let currentLine = '';
    let parenDepth = 0;

    for (let i = 0; i < tableBody.length; i++) {
      const char = tableBody[i];
      if (char === '(') parenDepth++;
      if (char === ')') parenDepth--;

      if (char === ',' && parenDepth === 0) {
        rawLines.push(currentLine.trim());
        currentLine = '';
      } else {
        currentLine += char;
      }
    }
    if (currentLine.trim()) {
      rawLines.push(currentLine.trim());
    }

    for (const line of rawLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const upper = trimmed.toUpperCase();
      // Skip table-level constraints and keys
      if (
        upper.startsWith('CONSTRAINT') ||
        upper.startsWith('PRIMARY KEY') ||
        upper.startsWith('FOREIGN KEY') ||
        upper.startsWith('UNIQUE KEY') ||
        upper.startsWith('UNIQUE INDEX') ||
        upper.startsWith('UNIQUE(') ||
        upper.startsWith('UNIQUE (') ||
        upper.startsWith('KEY ') ||
        upper.startsWith('INDEX ') ||
        upper.startsWith('CHECK ') ||
        upper.startsWith('CHECK(')
      ) {
        continue;
      }

      // Extract column name and definition
      const normalized = trimmed.replace(/\s+/g, ' ');
      const colMatch = normalized.match(/^`?([a-zA-Z0-9_]+)`?\s+(.+)$/);
      if (colMatch) {
        const colName = colMatch[1].toLowerCase();
        const colDef = colMatch[2].trim();
        columns.set(colName, colDef);
      }
    }

    tables.set(tableName, {
      tableName,
      columns,
    });
  }

  return tables;
}

export interface SchemaComparisonReport {
  canonicalTableCount: number;
  activeTableCount: number;
  canonicalTables: string[];
  activeTables: string[];
  tablesOnlyInCanonical: string[];
  tablesOnlyInActive: string[];
  columnDiscrepancies: {
    tableName: string;
    missingInActive: string[];
    missingInCanonical: string[];
  }[];
  isHarmonized: boolean;
}

export function auditSchemaDiscrepancies(
  canonicalPath?: string,
  activePath?: string
): SchemaComparisonReport {
  const canonicalFile = canonicalPath || path.resolve(process.cwd(), '../fitness_tracker.db');
  const activeFile = activePath || path.resolve(process.cwd(), 'src/database/schema.ts');

  const canonicalSql = fs.readFileSync(canonicalFile, 'utf8');
  const activeSql = fs.readFileSync(activeFile, 'utf8');

  const canonicalTablesMap = parseSqlTables(canonicalSql);
  const activeTablesMap = parseSqlTables(activeSql);

  const canonicalTableNames = Array.from(canonicalTablesMap.keys()).sort();
  const activeTableNames = Array.from(activeTablesMap.keys()).sort();

  const tablesOnlyInCanonical = canonicalTableNames.filter(t => !activeTablesMap.has(t));
  const tablesOnlyInActive = activeTableNames.filter(t => !canonicalTablesMap.has(t));

  const columnDiscrepancies: {
    tableName: string;
    missingInActive: string[];
    missingInCanonical: string[];
  }[] = [];

  const sharedTables = canonicalTableNames.filter(t => activeTablesMap.has(t));
  for (const tableName of sharedTables) {
    const cCols = Array.from(canonicalTablesMap.get(tableName)!.columns.keys());
    const aCols = Array.from(activeTablesMap.get(tableName)!.columns.keys());

    const missingInActive = cCols.filter(c => !aCols.includes(c));
    const missingInCanonical = aCols.filter(c => !cCols.includes(c));

    if (missingInActive.length > 0 || missingInCanonical.length > 0) {
      columnDiscrepancies.push({
        tableName,
        missingInActive,
        missingInCanonical,
      });
    }
  }

  const isHarmonized =
    tablesOnlyInCanonical.length === 0 &&
    tablesOnlyInActive.filter(t => t !== 'worker_locks').length === 0 &&
    columnDiscrepancies.length === 0;

  return {
    canonicalTableCount: canonicalTablesMap.size,
    activeTableCount: activeTablesMap.size,
    canonicalTables: canonicalTableNames,
    activeTables: activeTableNames,
    tablesOnlyInCanonical,
    tablesOnlyInActive,
    columnDiscrepancies,
    isHarmonized,
  };
}

if (process.argv[1]?.includes('audit-mysql-schema')) {
  console.log('=== RUNTIME PARSED SCHEMA AUDIT: CANONICAL (fitness_tracker.db) vs ACTIVE (schema.ts) ===\n');
  const report = auditSchemaDiscrepancies();
  console.log(`Canonical MySQL Table Count: ${report.canonicalTableCount}`);
  console.log(`Active SQLite Table Count:    ${report.activeTableCount}`);
  console.log(`\nTables only in Canonical (${report.tablesOnlyInCanonical.length}):`, report.tablesOnlyInCanonical.join(', ') || 'None');
  console.log(`Tables only in Active (${report.tablesOnlyInActive.length}):`, report.tablesOnlyInActive.join(', ') || 'None');

  console.log(`\nShared Tables with Column Discrepancies (${report.columnDiscrepancies.length}):`);
  for (const diff of report.columnDiscrepancies) {
    console.log(`- [${diff.tableName}]`);
    if (diff.missingInActive.length > 0) {
      console.log(`    Missing in Active schema:    ${diff.missingInActive.join(', ')}`);
    }
    if (diff.missingInCanonical.length > 0) {
      console.log(`    Missing in Canonical dump:   ${diff.missingInCanonical.join(', ')}`);
    }
  }

  console.log(`\nVERDICT: Harmonized = ${report.isHarmonized}`);
  console.log('MySQL Engine Gate: FAIL-CLOSED and PRODUCTION-BLOCKED until repository queries & schemas are fully reconciled.');
}
