var HOST = 'https://www.4kvm.net';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

function getSiteInfo() {
    return JSON.stringify({
        id: "4kvm",
        name: '4K影视',
        group: '影视',
        version: 1,
        host: 'https://www.4kvm.net',
        desc: '4K影视 - 电影、电视剧、动漫在线观看'
    });
}

function getTagInfo() {
    return JSON.stringify([
        { name: '电影', url: '{{host}}/filter?classify=1&page={{page}}' },
        { name: '电视剧', url: '{{host}}/filter?classify=2&page={{page}}' },
        { name: '动漫', url: '{{host}}/filter?classify=3&page={{page}}' }
    ]);
}

function parseTagRequest(url, page) {
    var u = String(url).replace(/\{\{host\}\}/g, HOST).replace(/\{\{page\}\}/g, String(page));
    return JSON.stringify({
        url: u,
        request: {
            method: 'get',
            headers: {
                'User-Agent': UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        }
    });
}

function wordArrayToBytes(wa) {
    var bytes = [];
    for (var i = 0; i < wa.sigBytes; i++) bytes.push((wa.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff);
    return bytes;
}

function bytesToWordArray(bytes) {
    var words = [];
    for (var i = 0; i < bytes.length; i++) words[i >>> 2] |= (bytes[i] & 0xff) << (24 - (i % 4) * 8);
    return CryptoJS.lib.WordArray.create(words, bytes.length);
}

function utf8Bytes(str) {
    return wordArrayToBytes(CryptoJS.enc.Utf8.parse(str));
}

function calcS(dataid, secret, t) {
    var sec = utf8Bytes(secret);
    var b1 = [], b2 = [];
    for (var i = 0; i < 64; i++) {
        var c = i < sec.length ? sec[i] : 0;
        b1.push(c ^ 0x36);
        b2.push(c ^ 0x5c);
    }
    var msg = utf8Bytes(dataid + ':' + t + ':' + secret);
    var h1 = CryptoJS.SHA256(bytesToWordArray(b1.concat(msg)));
    var h1b = wordArrayToBytes(h1);
    return CryptoJS.SHA256(bytesToWordArray(b2.concat(h1b))).toString(CryptoJS.enc.Hex).slice(0, 32);
}

function calcK(playKey) {
    if (!playKey || playKey === '0') return '0';
    var key = 'nbmovie2024secretkey';
    var pk = utf8Bytes(playKey);
    var out = [];
    for (var i = 0; i < pk.length; i++) out.push(pk[i] ^ key.charCodeAt(i % key.length));
    return bytesToWordArray(out).toString(CryptoJS.enc.Base64);
}

function pushCard(a, list, seen) {
    var href = a.getAttr('href') || '';
    if (href.indexOf('/play/') !== 0) return;
    if (seen[href]) return;
    var h3 = a.querySelector('h3');
    var name = h3 ? String(h3.text).replace(/\s+/g, ' ').trim() : '';
    if (!name) {
        var im0 = a.querySelector('img');
        name = im0 ? String(im0.getAttr('alt') || '').replace(/\s+/g, ' ').trim() : '';
    }
    if (!name) return;
    var pic = '';
    var imgs = a.querySelectorAll('img');
    for (var k = 0; k < imgs.length; k++) {
        var cand = imgs.at(k).getAttr('data-src') || imgs.at(k).getAttr('src') || '';
        if (!cand || cand.indexOf('/static/') === 0) continue;
        pic = cand;
        break;
    }
    seen[href] = 1;
    list.push({ vod_name: name, vod_id: HOST + href, vod_pic: pic });
}

function getMediaTagListByResponse(responseText) {
    var text = String(responseText);
    var doc = htmlParser.parse(text);
    var list = [];
    var seen = {};
    var nodes = doc.querySelectorAll('[data-vod-id]');
    var i;
    if (nodes && nodes.length > 0) {
        for (i = 0; i < nodes.length; i++) {
            var a = nodes.at(i).querySelector('a[href^="/play/"]');
            if (a) pushCard(a, list, seen);
        }
    } else {
        var links = doc.querySelectorAll('a[href^="/play/"]');
        for (i = 0; i < links.length; i++) pushCard(links.at(i), list, seen);
    }
    var pagecount = 1;
    var m = /共\s*(\d+)\s*页/.exec(text);
    if (m) pagecount = parseInt(m[1], 10) || 1;
    return JSON.stringify({ pagecount: pagecount, list: list });
}

function getMediaSearchRequest(keyword, page) {
    return JSON.stringify({
        url: HOST + '/search?q=' + encodeURIComponent(String(keyword)),
        request: {
            method: 'get',
            headers: {
                'User-Agent': UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        }
    });
}

function getMediaSearchByResponse(responseText) {
    return getMediaTagListByResponse(responseText);
}

function parseMediaPlaylistRequest(url) {
    return JSON.stringify({
        url: String(url),
        request: {
            method: 'get',
            headers: {
                'User-Agent': UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        }
    });
}

function getMediaPlaylistByResponse(responseText) {
    var doc = htmlParser.parse(String(responseText));
    var eps = doc.querySelectorAll('a.episode-link');
    var groups = {}, order = [];
    for (var i = 0; i < eps.length; i++) {
        var a = eps.at(i);
        var href = a.getAttr('href') || '';
        if (href.indexOf('/play/') !== 0) continue;
        var line = a.getAttr('data-line') || '1';
        if (!groups[line]) { groups[line] = []; order.push(line); }
        groups[line].push({ el: a, href: href });
    }
    if (order.length === 0) return JSON.stringify([]);
    order.sort();
    var chosen = groups[order[0]];
    var list = [], seen = {};
    for (var k = 0; k < chosen.length; k++) {
        var it = chosen[k];
        if (seen[it.href]) continue;
        seen[it.href] = 1;
        var name = String(it.el.text).replace(/\s+/g, ' ').trim();
        if (!name) {
            var ep = it.el.getAttr('data-episode');
            name = ep ? ('第' + ep + '集') : it.href;
        }
        list.push({ vod_name: name, vod_play_url: HOST + it.href, need_parse: true });
    }
    return JSON.stringify([{ server: '线路1', list: list }]);
}

var _playPageUrl = '';
var _lastUrl = '';

function parseMediaPlayUrlRequest(url, step) {
    var u = String(url);
    _lastUrl = u;
    if (u.indexOf('/video/play') < 0) _playPageUrl = u;
    var isApi = u.indexOf('/video/play') >= 0;
    return JSON.stringify({
        url: u,
        request: {
            method: 'get',
            headers: {
                'User-Agent': UA,
                'Accept': isApi ? 'application/json, text/plain, */*' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        }
    });
}

function getMediaPlayUrlByResponse(responseText, step) {
    var text = String(responseText || '');
    if (text.replace(/^\s+/, '').charAt(0) === '{') {
        var picked = '';
        try {
            var j = JSON.parse(text);
            var arr = (j && j.data && j.data.quality_urls) || [];
            var i;
            for (i = 0; i < arr.length; i++) {
                if (arr[i] && arr[i].locked !== true && /^https?:/.test(String(arr[i].url || ''))) { picked = String(arr[i].url); break; }
            }
            if (!picked) {
                for (i = 0; i < arr.length; i++) {
                    if (arr[i] && /^https?:/.test(String(arr[i].url || ''))) { picked = String(arr[i].url); break; }
                }
            }
        } catch (e) { }
        return JSON.stringify({ vod_play_url: picked, need_parse: false });
    }
    if (_lastUrl.indexOf('/video/play') >= 0) {
        return JSON.stringify({ vod_play_url: '', need_parse: false });
    }
    var slug = '';
    var slugM = /\/play\/([a-z0-9]+)/.exec(_playPageUrl);
    if (slugM) slug = slugM[1];
    var nbM = /id="nb-st"[^>]*content="(\d+)"/.exec(text);
    var ulM = /userlink:\s*'([^']*)'/.exec(text) || /userlink:\s*"([^"]*)"/.exec(text);
    var dataid = '';
    if (slug) {
        var cur = new RegExp('href="/play/' + slug + '"[^>]*dataid="(\\d+)"').exec(text);
        if (cur) dataid = cur[1];
    }
    if (!dataid) {
        var any = /dataid="(\d+)"/.exec(text);
        if (any) dataid = any[1];
    }
    var nbSt = nbM ? nbM[1] : '';
    var playKey = ulM ? ulM[1] : '0';
    var s = calcS(dataid, slug, nbSt);
    var k = calcK(playKey);
    var playUrl = HOST + '/video/play?p=' + dataid + '&v=' + slug + '&q=1080&s=' + s + '&t=' + nbSt + '&k=' + encodeURIComponent(k);
    return JSON.stringify({ vod_play_url: playUrl, need_parse: true });
}

function getMediaPlaybackOptions(url) {
    return JSON.stringify({ headers: { 'User-Agent': UA } });
}
