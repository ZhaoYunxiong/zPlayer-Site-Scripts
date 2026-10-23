function getSiteInfo() {
    return JSON.stringify({
        id: "xifan",
        name: "稀饭动漫",
        group: "影视",
        version: 2,
        host: "https://next.xifanacg.com",
        desc: "稀饭动漫 Next 在线番剧（浏览 / 分集 / 播放）",
        showHost: true
    });
}

function getTagInfo() {
    return JSON.stringify([
        { name: "全部番剧", url: "{{host}}/browse?page={{page}}" },
        { name: "TV 动画", url: "{{host}}/browse?format=tv&page={{page}}" },
        { name: "剧场版", url: "{{host}}/browse/format/movie?page={{page}}" }
    ]);
}

function parseTagRequest(url, page) {
    return JSON.stringify({
        url: url,
        request: {
            method: "get",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
            }
        }
    });
}

function getMediaTagListByResponse(responseText) {
    var root = htmlParser.parse(responseText);
    var anchors = root.querySelectorAll('a[href^="/anime/"]');
    var list = [];
    var seen = {};
    for (var i = 0; i < anchors.length; i++) {
        var a = anchors.at(i);
        var href = String(a.attr('href') || '');
        if (!/^\/anime\/\d+$/.test(href)) continue;
        if (seen[href]) continue;
        seen[href] = true;

        var name = String(a.attr('aria-label') || '').trim();
        if (!name) {
            var ps = a.querySelectorAll('p');
            if (ps.length > 0) name = String(ps.at(0).text || '').trim();
        }
        var pic = '';
        var img = a.querySelector('img');
        if (img) pic = String(img.attr('src') || '');

        list.push({
            vod_name: name,
            vod_id: "https://next.xifanacg.com" + href,
            vod_pic: pic
        });
    }

    var maxPage = 1;
    var re = /page=(\d+)/g;
    var m;
    while ((m = re.exec(responseText)) !== null) {
        var n = parseInt(m[1], 10);
        if (n > maxPage) maxPage = n;
    }

    return JSON.stringify({ pagecount: maxPage, list: list });
}

function parseMediaPlaylistRequest(url) {
    return JSON.stringify({
        url: url,
        request: {
            method: "get",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
            }
        }
    });
}

function getMediaPlaylistByResponse(responseText) {
    var root = htmlParser.parse(responseText);
    var anchors = root.querySelectorAll('a[href*="/play/"]');
    var items = [];
    var seen = {};
    var sourceCode = '';
    var serverName = '';

    var tabs = root.querySelectorAll('button[role="tab"]');
    for (var t = 0; t < tabs.length; t++) {
        var btn = tabs.at(t);
        if (String(btn.attr('aria-selected') || '') !== 'true') continue;
        var spans = btn.querySelectorAll('span');
        for (var s = 0; s < spans.length; s++) {
            var cls = String(spans.at(s).attr('class') || '');
            if (cls.indexOf('tabular-nums') >= 0) continue;
            var txt = String(spans.at(s).text || '').trim();
            if (txt) { serverName = txt; break; }
        }
        break;
    }

    for (var i = 0; i < anchors.length; i++) {
        var a = anchors.at(i);
        var href = String(a.attr('href') || '');
        var m = /^\/anime\/\d+\/play\/(\d+)\?source=([^&"]+)(?:&[^"]*)?$/.exec(href);
        if (!m) continue;
        var aria = String(a.attr('aria-label') || '');
        if (aria.indexOf('观看') >= 0) continue;
        if (seen[href]) continue;
        seen[href] = true;

        var code = m[2];
        if (!sourceCode) sourceCode = code;
        if (code !== sourceCode) continue;

        var title = '';
        var spans2 = a.querySelectorAll('span');
        for (var s2 = 0; s2 < spans2.length; s2++) {
            var cls2 = String(spans2.at(s2).attr('class') || '');
            if (cls2.indexOf('items-baseline') >= 0) {
                title = String(spans2.at(s2).text || '').trim();
                break;
            }
        }
        if (!title) title = '第' + (items.length + 1) + '集';

        items.push({
            vod_name: title,
            vod_play_url: "https://next.xifanacg.com" + href,
            need_parse: true
        });
    }

    if (items.length === 0) return JSON.stringify([]);
    var server = serverName || sourceCode || '默认线路';
    return JSON.stringify([{ server: server, list: items }]);
}

function parseMediaPlayUrlRequest(url, step) {
    var m = /\/play\/(\d+)/.exec(String(url || ''));
    var episodeId = m ? parseInt(m[1], 10) : 0;
    return JSON.stringify({
        url: "https://api.xifanacg.com/functions/v1/issue-web-playback",
        preserveHost: true,
        request: {
            method: "post",
            headers: {
                "apikey": "sb_publishable_OBIVAWACIX6lPXrO98_z24_HcsmalkA",
                "Authorization": "Bearer sb_publishable_OBIVAWACIX6lPXrO98_z24_HcsmalkA",
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
            },
            data: {
                action: "fallback",
                episode_id: episodeId
            }
        }
    });
}

function getMediaPlayUrlByResponse(responseText, step) {
    var playUrl = '';
    try {
        var data = JSON.parse(responseText);
        if (data && data.ok === true) {
            playUrl = data.url || '';
            if (!playUrl && data.candidates && data.candidates.length > 0) {
                playUrl = data.candidates[0].url || '';
            }
        }
    } catch (e) {
        playUrl = '';
    }
    return JSON.stringify({ vod_play_url: playUrl, need_parse: false });
}

// 云盘下载线路在携带 Referer 时会拒绝请求，播放时仅保留已验证可用的 User-Agent。
function getMediaPlaybackOptions(url) {
    return JSON.stringify({
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
        }
    });
}
