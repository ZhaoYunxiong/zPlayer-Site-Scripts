import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const identifier = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const catalogFields = new Set(['id', 'name', 'group', 'version', 'desc', 'author']);
const maxScriptBytes = 4 * 1024 * 1024;
const maxCatalogBytes = 2 * 1024 * 1024;

function fail(file, message) {
    throw new Error(`${file}: ${message}`);
}

function isIdentifier(value) {
    return typeof value === 'string' && value.trim() === value && identifier.test(value);
}

function readObject(file) {
    const value = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        fail(file, 'expected a JSON object');
    }
    return value;
}

function siteInfoFunction(statement) {
    if (statement.type === 'FunctionDeclaration' && statement.id?.name === 'getSiteInfo') {
        return statement;
    }
    if (statement.type === 'VariableDeclaration') {
        return statement.declarations.filter(item => item.id.type === 'Identifier' && item.id.name === 'getSiteInfo')
            .map(item => item.init);
    }
    if (statement.type === 'ExpressionStatement' && statement.expression.type === 'AssignmentExpression') {
        const assignment = statement.expression;
        if (assignment.operator === '=' && assignment.left.type === 'Identifier' && assignment.left.name === 'getSiteInfo') {
            return assignment.right;
        }
    }
    return [];
}

// 只读取语法树中的字面量；绝不 import、eval 或调用投稿脚本。
export function extractMetadata(code, file = 'script.js') {
    let ast;
    try {
        ast = parse(code, { ecmaVersion: 'latest', sourceType: 'script' });
    } catch (error) {
        fail(file, `JavaScript syntax error: ${error.message}`);
    }
    const definitions = ast.body.flatMap(siteInfoFunction);
    if (definitions.length !== 1) fail(file, 'define exactly one top-level getSiteInfo function');
    const fn = definitions[0];
    if (!fn || !['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(fn.type) || fn.async || fn.generator) {
        fail(file, 'getSiteInfo must be a synchronous function');
    }
    let returned = fn.body;
    if (fn.body.type === 'BlockStatement') {
        const returns = fn.body.body.filter(statement => statement.type === 'ReturnStatement');
        if (returns.length !== 1) fail(file, 'getSiteInfo must directly return JSON.stringify({ ... })');
        returned = returns[0].argument;
    }
    if (returned?.type !== 'CallExpression' || returned.optional || returned.arguments.length !== 1 ||
        returned.callee.type !== 'MemberExpression' || returned.callee.computed || returned.callee.optional ||
        returned.callee.object.type !== 'Identifier' || returned.callee.object.name !== 'JSON' ||
        returned.callee.property.name !== 'stringify' || returned.arguments[0].type !== 'ObjectExpression') {
        fail(file, 'getSiteInfo must directly return JSON.stringify({ ... }) with literal metadata');
    }
    const metadata = Object.create(null);
    const keys = new Set();
    for (const property of returned.arguments[0].properties) {
        if (property.type !== 'Property' || property.computed || property.method || property.kind !== 'init' || property.shorthand) {
            fail(file, 'getSiteInfo metadata cannot use spreads, computed keys, methods or shorthand properties');
        }
        const key = property.key.type === 'Identifier' ? property.key.name : property.key.value;
        if (keys.has(key)) fail(file, `duplicate getSiteInfo field: ${key}`);
        keys.add(key);
        if (!catalogFields.has(key)) continue;
        const value = property.value;
        if (value.type === 'Literal' && !value.regex && typeof value.value !== 'bigint') {
            metadata[key] = value.value;
        } else if (value.type === 'TemplateLiteral' && value.expressions.length === 0) {
            metadata[key] = value.quasis[0].value.cooked;
        } else {
            fail(file, `${key} must be a literal value, not an expression or function call`);
        }
    }
    if (!isIdentifier(metadata.id)) fail(file, 'getSiteInfo.id must be a stable lowercase identifier (1-80 characters)');
    for (const key of ['name', 'group']) {
        if (typeof metadata[key] !== 'string' || !metadata[key].trim()) fail(file, `getSiteInfo.${key} is required`);
    }
    if (!Number.isInteger(metadata.version) || metadata.version < 1 || metadata.version > 2147483647) {
        fail(file, 'getSiteInfo.version must be a positive 32-bit integer');
    }
    for (const key of ['desc', 'author']) {
        if (metadata[key] !== undefined && typeof metadata[key] !== 'string') fail(file, `getSiteInfo.${key} must be a string`);
    }
    return metadata;
}

function rejectSymlink(file) {
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) fail(file, 'symbolic links are not supported');
}

function escapeHtml(value) {
    return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

export function build(root) {
    root = fs.realpathSync(root);
    const sourcePath = path.join(root, 'source.json');
    const source = readObject(sourcePath);
    if (source.schemaVersion !== 1 || !isIdentifier(source.id) || typeof source.name !== 'string' || !source.name.trim()) {
        fail(sourcePath, 'invalid schemaVersion, id or name');
    }
    const scripts = path.join(root, 'scripts');
    rejectSymlink(scripts);
    const files = fs.readdirSync(scripts).filter(file => file.endsWith('.js')).sort();
    if (files.length > 5000) fail(scripts, 'catalog may contain at most 5000 scripts');
    const ids = new Set();
    const entries = [];
    const downloads = [];
    for (const file of files) {
        const codePath = path.join(scripts, file);
        rejectSymlink(codePath);
        if (!fs.statSync(codePath).isFile() || fs.statSync(codePath).size > maxScriptBytes) {
            fail(codePath, 'expected a script file no larger than 4 MiB');
        }
        const bytes = fs.readFileSync(codePath);
        const code = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        const metadata = extractMetadata(code, file);
        if (ids.has(metadata.id)) fail(file, `duplicate script id: ${metadata.id}`);
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        const url = `scripts/${metadata.id}/v${metadata.version}-${sha256}.js`;
        entries.push({
            id: metadata.id,
            name: metadata.name,
            group: metadata.group,
            description: metadata.desc ?? '',
            author: metadata.author ?? '',
            version: metadata.version,
            url,
            sha256,
        });
        downloads.push({ url, bytes });
        ids.add(metadata.id);
    }
    const catalog = { schemaVersion: 1, id: source.id, name: source.name, scripts: entries };
    const content = JSON.stringify(catalog, null, 2) + '\n';
    if (Buffer.byteLength(content) > maxCatalogBytes) fail(scripts, 'catalog exceeds 2 MiB');

    // 校验全部通过后才替换固定的 _site 产物目录，不触碰源脚本。
    const output = path.resolve(root, '_site');
    if (path.dirname(output) !== root) fail(output, 'output must be inside the source repository');
    rejectSymlink(output);
    fs.rmSync(output, { recursive: true, force: true });
    fs.mkdirSync(output, { recursive: true });
    for (const { url, bytes } of downloads) {
        const target = path.join(output, url);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes);
    }
    fs.writeFileSync(path.join(output, 'index.json'), content, 'utf8');
    fs.writeFileSync(path.join(output, '.nojekyll'), '');
    const title = escapeHtml(source.name);
    fs.writeFileSync(path.join(output, 'index.html'),
        '<!doctype html><html lang="zh-CN"><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        `<title>${title}</title><h1>${title}</h1>` +
        '<p>在 zPlayer 的“脚本源”中添加本页面地址后接 <a href="index.json">index.json</a>。</p>' +
        `<p>当前收录 ${entries.length} 个脚本。</p></html>`, 'utf8');
    return catalog;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const catalog = build(path.dirname(fileURLToPath(import.meta.url)));
        console.log(`Generated ${catalog.scripts.length} scripts in _site/`);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
