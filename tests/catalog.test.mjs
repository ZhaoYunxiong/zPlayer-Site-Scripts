import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { build, extractMetadata } from '../build_catalog.mjs';

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zplayer-source-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, 'scripts'));
    fs.writeFileSync(path.join(root, 'source.json'), JSON.stringify({ schemaVersion: 1, id: 'alice', name: 'Alice' }));
    return root;
}

function metadata(overrides = {}) {
    return JSON.stringify({ id: 'example', name: 'Example', group: 'Test', version: 1, desc: 'Description', ...overrides });
}

function script(fields = metadata()) {
    return `function getSiteInfo() { return JSON.stringify(${fields}); }`;
}

test('publishes exact BOM/CRLF bytes and metadata from the JS file only', t => {
    const root = fixture(t);
    const bytes = Buffer.from('\uFEFF' + script(metadata({ version: 4, name: '测试站点', author: 'Alice' })) + '\r\n');
    fs.writeFileSync(path.join(root, 'scripts', '中文脚本.js'), bytes);
    // 旧的配套 JSON 不参与读取，不能覆盖 JS 中的版本或名称。
    fs.writeFileSync(path.join(root, 'scripts', '中文脚本.json'), '{"name":"wrong","version":999}');
    const catalog = build(root);
    const [entry] = catalog.scripts;
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    assert.equal(entry.version, 4);
    assert.equal(entry.name, '测试站点');
    assert.equal(entry.author, 'Alice');
    assert.equal(entry.description, 'Description');
    assert.equal(entry.sha256, sha256);
    assert.equal(entry.url, `scripts/example/v4-${sha256}.js`);
    assert.deepEqual(fs.readFileSync(path.join(root, '_site', entry.url)), bytes);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, '_site/index.json'), 'utf8')), catalog);
});

test('extracts comments, quoted keys, escapes and nested parameter declarations', () => {
    const code = `
        // function getSiteInfo(){return JSON.stringify({id:'wrong'});}
        const text = 'getSiteInfo { id: "wrong", name: "wrong" }';
        function getSiteInfo() {
            // version: 999
            return JSON.stringify({
                id: 'actual', 'name': 'A \\'quoted\\' name', group: '影视', version: 2,
                desc: "Braces { } and // are part of the description",
                parameters: [{id:'not-the-script', name:'not-the-site', type:'password'}],
            });
        }
    `;
    const result = extractMetadata(code);
    assert.equal(result.id, 'actual');
    assert.equal(result.name, "A 'quoted' name");
    assert.equal(result.version, 2);
    assert.equal(result.desc, 'Braces { } and // are part of the description');
});

test('supports top-level function, variable and assignment declarations', async t => {
    for (const code of [
        script(),
        `const getSiteInfo = function(){return JSON.stringify(${metadata()});};`,
        `getSiteInfo = () => JSON.stringify(${metadata()});`,
        `var getSiteInfo = () => { return JSON.stringify(${metadata()}); };`,
    ]) {
        await t.test(code.slice(0, 40), () => assert.equal(extractMetadata(code).id, 'example'));
    }
});

test('never executes top-level code, getSiteInfo statements or parameter expressions', t => {
    const root = fixture(t);
    const marker = path.join(root, 'must-not-exist');
    fs.writeFileSync(path.join(root, 'scripts', 'example.js'), `
        require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed');
        throw new Error('must not execute');
        function getSiteInfo() {
            throw new Error('must not invoke getSiteInfo');
            return JSON.stringify({id:'example',name:'Example',group:'Test',version:1,parameters: dangerous()});
        }
    `);
    assert.equal(build(root).scripts.length, 1);
    assert.equal(fs.existsSync(marker), false);
});

test('rejects duplicate script IDs and preserves previous build on validation failure', t => {
    const root = fixture(t);
    fs.writeFileSync(path.join(root, 'scripts', 'one.js'), script());
    build(root);
    const previous = fs.readFileSync(path.join(root, '_site/index.json'));
    fs.writeFileSync(path.join(root, 'scripts', 'two.js'), script());
    assert.throws(() => build(root), /duplicate script id/);
    assert.deepEqual(fs.readFileSync(path.join(root, '_site/index.json')), previous);
});

test('rejects missing ID, invalid IDs, names, groups and versions', async t => {
    for (const overrides of [
        { id: undefined }, { id: '../outside' }, { id: 'bad\r' }, { id: 'bad\n' }, { id: '大写' },
        { name: '' }, { group: '' }, { version: undefined }, { version: 0 }, { version: true },
        { version: 1.5 }, { version: 2147483648 }, { desc: 42 }, { author: false },
    ]) {
        await t.test(JSON.stringify(overrides), () => assert.throws(() => extractMetadata(script(metadata(overrides)))));
    }
});

test('rejects metadata expressions, spreads, duplicate fields and getters', async t => {
    for (const fields of [
        "{id:generateId(),name:'Example',group:'Test',version:1}",
        "{id:'example',name:'Example',group:'Test',version:getVersion()}",
        "{id:'example',name:'Example',group:'Test',version:1,...other}",
        "{id:'example',name:'Example',group:'Test',version:1,version:2}",
        "{id:'example',name:'Example',group:'Test',version:1,get desc(){return 'x';}}",
        "{['id']:'example',name:'Example',group:'Test',version:1}",
    ]) {
        await t.test(fields, () => assert.throws(() => extractMetadata(script(fields))));
    }
});

test('rejects ambiguous declarations, dynamic returns and invalid JavaScript', () => {
    assert.throws(() => extractMetadata(script() + script()), /exactly one/);
    assert.throws(() => extractMetadata('function getSiteInfo(){return buildInfo();}'), /directly return/);
    assert.throws(() => extractMetadata('function getSiteInfo(){return JSON.stringify('), /syntax error/);
    assert.throws(() => extractMetadata('async ' + script()), /synchronous/);
});

test('supports an empty source before scripts are migrated', t => {
    const root = fixture(t);
    assert.deepEqual(build(root).scripts, []);
});
