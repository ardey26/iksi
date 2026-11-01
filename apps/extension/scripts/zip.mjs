// Packs the extension for the Chrome Web Store: dist/iksi-extension-<version>.zip
// with manifest.json at the root. Dependency-free (node:zlib), and the same
// files always give the same bytes (fixed timestamps, sorted entries).
import { readFileSync, readdirSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const INCLUDE = ['manifest.json', 'icons', 'src'];

function walk(path) {
	if (statSync(path).isFile()) return [path];
	return readdirSync(path)
		.filter((name) => !name.startsWith('.'))
		.flatMap((name) => walk(join(path, name)));
}

const files = INCLUDE.flatMap((p) => walk(join(root, p)))
	.map((abs) => ({ abs, name: relative(root, abs).split(sep).join('/') }))
	.sort((a, b) => a.name.localeCompare(b.name));

const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01

const locals = [];
const centrals = [];
let offset = 0;
for (const { abs, name } of files) {
	const data = readFileSync(abs);
	const packed = deflateRawSync(data, { level: 9 });
	const stored = packed.length >= data.length;
	const body = stored ? data : packed;
	const nameBuf = Buffer.from(name, 'utf8');
	const crc = crc32(data);

	const local = Buffer.alloc(30);
	local.writeUInt32LE(0x04034b50, 0);
	local.writeUInt16LE(20, 4); // version needed
	local.writeUInt16LE(0x0800, 6); // UTF-8 names
	local.writeUInt16LE(stored ? 0 : 8, 8);
	local.writeUInt16LE(DOS_TIME, 10);
	local.writeUInt16LE(DOS_DATE, 12);
	local.writeUInt32LE(crc, 14);
	local.writeUInt32LE(body.length, 18);
	local.writeUInt32LE(data.length, 22);
	local.writeUInt16LE(nameBuf.length, 26);
	local.writeUInt16LE(0, 28);
	locals.push(local, nameBuf, body);

	const central = Buffer.alloc(46);
	central.writeUInt32LE(0x02014b50, 0);
	central.writeUInt16LE(20, 4); // made by
	central.writeUInt16LE(20, 6); // version needed
	central.writeUInt16LE(0x0800, 8);
	central.writeUInt16LE(stored ? 0 : 8, 10);
	central.writeUInt16LE(DOS_TIME, 12);
	central.writeUInt16LE(DOS_DATE, 14);
	central.writeUInt32LE(crc, 16);
	central.writeUInt32LE(body.length, 20);
	central.writeUInt32LE(data.length, 24);
	central.writeUInt16LE(nameBuf.length, 28);
	central.writeUInt32LE(offset, 42);
	centrals.push(central, nameBuf);

	offset += local.length + nameBuf.length + body.length;
}

const centralSize = centrals.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

const { version } = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const out = join(root, 'dist', `iksi-extension-${version}.zip`);
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(out, Buffer.concat([...locals, ...centrals, end]));
console.log(`${relative(root, out)}: ${files.length} files, ${(statSync(out).size / 1024).toFixed(1)} KB`);
