function getSiteInfo() {
    return JSON.stringify({
        id: "age",
        name: "AGE动漫",
        group: "影视",
        version: 1,
        host: "https://m.agedongman.net",
        desc: "AGE动漫手机版，分类/详情/选集播放解析（初版仅支持已确认线路：推荐线路3）"
    });
}

// 初版仅暴露已实测可播的线路（其余线路直链当前不可用，不纳入）
var AGE_SUPPORTED_SERVERS = ["推荐线路3"];

function getTagInfo() {
    return JSON.stringify([
        { name: "日漫", url: "{{host}}/h/1/" },
        { name: "国漫", url: "{{host}}/h/2/" },
        { name: "美漫", url: "{{host}}/h/3/" },
        { name: "动漫剧场", url: "{{host}}/h/20/" }
    ]);
}

// 分类分页：第1页 /h/1/ ，第2页起 /h/1-2/ 形式
function parseTagRequest(url, page) {
    var u = String(url || '').replace(/\/+$/, '');
    var p = parseInt(page, 10);
    if (p > 1) { u += '-' + p; }
    return JSON.stringify({ url: u + '/' });
}

function getMediaTagListByResponse(responseText) {
    var doc = htmlParser.parse(responseText);
    var items = doc.querySelectorAll('article.u-movie');
    var list = [];
    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var a = it.querySelector('a[href]');
        var href = a ? (a.getAttr('href') || '') : '';
        if (!/^\/p\/\d+\/?$/.test(href)) { continue; }
        var name = a ? (a.getAttr('title') || '') : '';
        if (!name) {
            var h2 = it.querySelector('h2');
            if (h2) { name = strUtil.trim(h2.text || ''); }
        }
        var img = it.querySelector('img');
        var pic = img ? (img.getAttr('data-original') || img.getAttr('src') || '') : '';
        var zt = it.querySelector('div.zhuangtai');
        var note = zt ? strUtil.trim(zt.text || '') : '';
        var tg = it.querySelector('div.meta span.tags');
        var tm = tg ? strUtil.trim(tg.text || '') : '';
        list.push({
            vod_name: name,
            vod_id: 'https://m.agedongman.net' + href,
            vod_pic: pic,
            vod_play_note: note,
            vod_time: tm
        });
    }
    var pagecount = 1;
    var m = /共\s*\d+\s*\/\s*(\d+)\s*页/.exec(responseText);
    if (m) { pagecount = parseInt(m[1], 10); }
    return JSON.stringify({ pagecount: pagecount, list: list });
}

// 本站详情页 /p/{id}/ 不含分集，分集在播放页 /v/{id}-1-1.html 中渲染
function parseMediaPlaylistRequest(url) {
    var s = String(url || '');
    var m = /\/p\/(\d+)/.exec(s);
    if (m) {
        return JSON.stringify({ url: 'https://m.agedongman.net/v/' + m[1] + '-1-1.html' });
    }
    return JSON.stringify({ url: s });
}

// 从播放页解析线路与分集：线路名来自 #playnav li，分集来自 #playcontainer 各 section
function getMediaPlaylistByResponse(responseText) {
    var doc = htmlParser.parse(responseText);
    var navLis = doc.querySelectorAll('#playnav li');
    var sections = doc.querySelectorAll('#playcontainer section');
    var result = [];
    for (var i = 0; i < sections.length; i++) {
        var serverName = '';
        if (navLis && i < navLis.length && navLis[i]) {
            serverName = strUtil.trim(navLis[i].text || '');
        }
        var keep = false;
        for (var k = 0; k < AGE_SUPPORTED_SERVERS.length; k++) {
            if (serverName === AGE_SUPPORTED_SERVERS[k]) { keep = true; break; }
        }
        if (!keep) { continue; }
        var links = sections[i].querySelectorAll('a');
        var eps = [];
        for (var j = 0; j < links.length; j++) {
            var href = links[j].getAttr('href') || '';
            var epName = strUtil.trim(links[j].text || '');
            if (!/^\/v\/\d+-\d+-\d+\/?$/.test(href)) { continue; }
            if (!epName) { continue; }
            eps.push({
                vod_name: epName,
                vod_play_url: 'https://m.agedongman.net' + href,
                need_parse: true
            });
        }
        if (eps.length > 0) {
            result.push({ server: serverName, list: eps });
        }
    }
    return JSON.stringify(result);
}

function parseMediaPlayUrlRequest(url, step) {
    return JSON.stringify({ url: String(url || '') });
}

// 分集页内 player_aaaa.url 即最终 m3u8 地址；encrypt=1 用 unescape，=2 先 Base64 再 unescape
function getMediaPlayUrlByResponse(responseText, step) {
    var playUrl = '';
    var idx = responseText.indexOf('player_aaaa=');
    if (idx >= 0) {
        var start = responseText.indexOf('{', idx);
        var end = responseText.indexOf('</script>', start);
        if (start >= 0 && end > start) {
            var jsonText = responseText.substring(start, end).replace(/;\s*$/, '');
            try {
                var data = JSON.parse(jsonText);
                playUrl = data.url || '';
                if (playUrl) {
                    var encrypt = data.encrypt;
                    if (encrypt === 1 || encrypt === '1') {
                        playUrl = unescape(playUrl);
                    } else if (encrypt === 2 || encrypt === '2') {
                        playUrl = unescape(Base64.decode(playUrl));
                    } else if (playUrl.charAt(0) === '%') {
                        playUrl = unescape(playUrl);
                    }
                }
            } catch (e) {
                playUrl = '';
            }
        }
    }
    return JSON.stringify({ vod_play_url: playUrl, need_parse: false });
}
