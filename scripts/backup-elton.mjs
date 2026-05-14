import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
const src = join(process.cwd(), 'lib/deepseek.ts');
const dir = join(process.cwd(), 'lib/backups');
const dst = join(dir, `deepseek_${stamp}.ts`);

mkdirSync(dir, { recursive: true });
writeFileSync(dst, readFileSync(src));
console.log(`Backup criado: lib/backups/deepseek_${stamp}.ts`);
