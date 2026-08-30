import fs from 'fs';
import path from 'path';
import { auditSchemaDiscrepancies } from './audit-mysql-schema.js';

const report = auditSchemaDiscrepancies();
fs.writeFileSync(
  path.resolve(process.cwd(), 'src/database/schema-divergence-inventory.json'),
  JSON.stringify(report, null, 2),
  'utf8'
);
console.log(`Exported ${report.columnDiscrepancies.length} discrepancies to src/database/schema-divergence-inventory.json`);
