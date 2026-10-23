function getSiteInfo() {
    return JSON.stringify({
        id: "huazi",
        name: "花子动漫",
        group: "影视",
        version: 1,
        host: "https://www.huazidm.com",
        desc: "花子动漫-新番在线观看"
    });
}

function getTagInfo() {
    return JSON.stringify([
        { name: "TV动画", url: "https://www.huazidm.com/vodtype/1.html" },
        { name: "连载动画", url: "https://www.huazidm.com/vodtype/20.html" },
        { name: "剧场", url: "https://www.huazidm.com/vodtype/2.html" },
        { name: "特摄", url: "https://www.huazidm.com/vodtype/3.html" },
        { name: "美漫", url: "https://www.huazidm.com/vodtype/4.html" },
        { name: "韩剧", url: "https://www.huazidm.com/vodtype/22.html" }
    ]);
}

var _tagPage = 1;

function parseTagRequest(url, page) {
    _tagPage = page || 1;
    var m = /\/vodtype\/(\d+)\.html/.exec(url);
    if (m) {
        url = "https://www.huazidm.com/vodtype/" + m[1] + "-" + _tagPage + ".html";
    }
    return JSON.stringify({
        url: url,
        request: { method: "get", headers: { "Referer": "https://www.huazidm.com/" } }
    });
}

function getMediaTagListByResponse(responseText) {
    const doc = htmlParser.parse(responseText);
    const items = doc.querySelectorAll('.module-poster-item');
    const list = [];
    const seen = {};
    for (let i = 0; i < items.length; i++) {
        const el = items.at(i);
        let href = el.getAttr('href') || '';
        if (!/\/voddetail\/\d+\.html/.test(href)) continue;
        if (href.indexOf('http') !== 0) href = 'https://www.huazidm.com' + href;
        if (seen[href]) continue;
        seen[href] = 1;
        let name = el.getAttr('title') || '';
        if (!name) {
            const t = el.querySelector('.module-poster-item-title');
            name = t ? t.text : '';
        }
        let pic = '';
        const img = el.querySelector('img');
        if (img) pic = img.getAttr('data-original') || img.getAttr('src') || '';
        let note = '';
        const noteEl = el.querySelector('.module-item-note');
        if (noteEl) note = noteEl.text;
        list.push({
            vod_name: name.replace(/\s+/g, ' ').trim(),
            vod_id: href,
            vod_pic: pic,
            vod_play_note: note
        });
    }
    const pagecount = list.length > 0 ? _tagPage + 1 : 1;
    return JSON.stringify({ pagecount: pagecount, list: list });
}

function parseMediaPlaylistRequest(url) {
    return JSON.stringify({
        url: url,
        request: { method: "get", headers: { "Referer": "https://www.huazidm.com/" } }
    });
}

function getMediaPlaylistByResponse(responseText) {
    const doc = htmlParser.parse(responseText);
    const tabs = doc.querySelectorAll('#y-playList .module-tab-item');
    const lists = doc.querySelectorAll('.module-play-list');
    const servers = [];
    const n = Math.min(tabs.length, lists.length);
    for (let i = 0; i < n; i++) {
        let name = tabs.at(i).getAttr('data-dropdown-value') || ('线路' + (i + 1));
        const links = lists.at(i).querySelectorAll('a.module-play-list-link');
        const eps = [];
        for (let j = 0; j < links.length; j++) {
            const a = links.at(j);
            let href = a.getAttr('href') || '';
            if (!/\/vodplay\/\d+-\d+-\d+\.html/.test(href)) continue;
            if (href.indexOf('http') !== 0) href = 'https://www.huazidm.com' + href;
            let ep = a.text.replace(/\s+/g, '') || a.getAttr('title') || '';
            eps.push({ vod_name: ep, vod_play_url: href, need_parse: true });
        }
        if (eps.length > 0) servers.push({ server: name, list: eps });
    }
    return JSON.stringify(servers);
}

function parseMediaPlayUrlRequest(url, step) {
    return JSON.stringify({
        url: url,
        request: {
            method: "get",
            headers: {
                "Referer": "https://www.huazidm.com/",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            }
        }
    });
}

function getMediaPlayUrlByResponse(responseText, step) {
    const text = String(responseText || '');
    // 情况一：MacCMS 播放页，含 player_aaaa
    if (text.indexOf('player_aaaa') > -1) {
        let enc = 0;
        const em = /"encrypt"\s*:\s*([0-9]+)/.exec(text);
        if (em) enc = parseInt(em[1], 10);
        const um = /"url"\s*:\s*"([^"]+)"/.exec(text);
        if (um) {
            let playUrl = um[1];
            if (enc === 1) {
                playUrl = unescape(playUrl);
            } else if (enc === 2) {
                playUrl = unescape(Base64.decode(playUrl));
            }
            if (/^https?:\/\//.test(playUrl)) {
                return JSON.stringify({ vod_play_url: playUrl, need_parse: false });
            }
            if (/^[0-9a-f]+$/i.test(playUrl)) {
                return JSON.stringify({
                    vod_play_url: 'https://play.huazidm.xyz/?url=' + playUrl,
                    need_parse: true
                });
            }
        }
    }
    // 情况二：解析站页面，含 config = { url: ... }
    const cm = /var\s+config\s*=\s*(\{[\s\S]*?\})\s*;/.exec(text);
    if (cm) {
        let cfg = null;
        try { cfg = JSON.parse(cm[1]); } catch (e) { cfg = null; }
        if (cfg && cfg.url) {
            const u = cfg.url;
            if (/\.(m3u8|mp4|flv|ts|mpd)(\?|$)/i.test(u)) {
                return JSON.stringify({ vod_play_url: u, need_parse: false });
            }
            return JSON.stringify({ vod_play_url: u, need_parse: true });
        }
    }
    return JSON.stringify({ vod_play_url: '', need_parse: false });
}

function getMediaPlaybackOptions(url) {
    return JSON.stringify({
        headers: {
            "Referer": "https://www.huazidm.com/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        }
    });
}
