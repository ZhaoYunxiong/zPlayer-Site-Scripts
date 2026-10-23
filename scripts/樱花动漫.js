function getSiteInfo() {
    return JSON.stringify({
        id: "yhdm",
        name: "樱花动漫",
        group: "影视",
        version: 1,
        host: "https://yhdm6.top",
        desc: "樱花动漫 - 专注动漫的门户网站",
        showHost: true
    });
}

function getTagInfo() {
    return JSON.stringify([
        { name: "日本动漫", url: "{{host}}/s/1.html" },
        { name: "动漫电影", url: "{{host}}/s/2.html" },
        { name: "欧美动漫", url: "{{host}}/s/3.html" },
        { name: "国产动漫", url: "{{host}}/s/4.html" },
        { name: "最近更新", url: "{{host}}/map.html" }
    ]);
}

function parseTagRequest(url, page) {
    var p = parseInt(page) || 1;
    var target = url;
    if (p > 1) {
        target = url.replace(/\.html$/, "-" + p + ".html");
        if (target === url) {
            target = url + (url.indexOf("?") >= 0 ? "&" : "?") + "page=" + p;
        }
    }
    return JSON.stringify({
        url: target,
        request: {
            method: "get",
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" }
        }
    });
}

function getMediaSearchRequest(keyword, page) {
    var p = parseInt(page) || 1;
    return JSON.stringify({
        url: "{{host}}/vodsearch/-------------.html?wd=" + encodeURIComponent(keyword) + "&page=" + p,
        request: {
            method: "get",
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" }
        }
    });
}

function _absUrl(href) {
    if (!href) return "";
    if (href.indexOf("//") === 0) return "https:" + href;
    if (href.indexOf("http") === 0) return href;
    if (href.charAt(0) === "/") return "{{host}}" + href;
    return "{{host}}/" + href;
}

function _parseList(responseText) {
    var list = [];
    var pagecount = 1;
    try {
        var doc = htmlParser.parse(responseText);
        var items = doc.querySelectorAll("li.vodlist_item");
        if (!items || !items.length) {
            items = doc.querySelectorAll("a.vodlist_thumb");
        }
        var totalPages = 1;
        try {
            var vm = /data-total-pages=["']?(\d+)/.exec(responseText);
            if (vm) totalPages = parseInt(vm[1]);
        } catch (e1) {}
        var seen = {};
        for (var i = 0; i < items.length; i++) {
            var el = items.at(i);
            var a = null;
            var pic = "";
            var name = "";
            var note = "";
            if (el.getAttr && el.getAttr("href")) {
                a = el;
            } else {
                a = el.querySelector ? el.querySelector("a.vodlist_thumb") : null;
            }
            if (!a) continue;
            var href = a.getAttr("href") || "";
            name = a.getAttr("title") || "";
            pic = a.getAttr("data-original") || a.getAttr("data-src") || a.getAttr("src") || "";
            var noteEl = a.querySelector ? a.querySelector("span.pic_text") : null;
            if (noteEl) note = noteEl.text || "";
            if (!name || !href) continue;
            if (seen[href]) continue;
            seen[href] = 1;
            list.push({
                vod_name: strUtil.trim(name),
                vod_id: _absUrl(href),
                vod_pic: pic,
                vod_play_note: strUtil.trim(note)
            });
        }
        pagecount = totalPages > 0 ? totalPages : 1;
    } catch (e) {
        console.error("parse list error: " + e);
    }
    return JSON.stringify({ pagecount: pagecount, list: list });
}

function getMediaTagListByResponse(responseText) {
    return _parseList(responseText);
}

function getMediaSearchByResponse(responseText) {
    return _parseList(responseText);
}

function getMediaPlaylistByResponse(responseText) {
    var result = [];
    try {
        var doc = htmlParser.parse(responseText);
        var tabs = doc.querySelectorAll("#NumTab a");
        var boxes = doc.querySelectorAll("div.play_list_box");
        if (!boxes || !boxes.length) {
            var all = doc.querySelectorAll("div.playlist_full ul.content_playlist");
            boxes = all;
        }
        for (var i = 0; i < boxes.length; i++) {
            var box = boxes.at(i);
            var serverName = "线路" + (i + 1);
            if (tabs && tabs.length > i) {
                var tname = tabs.at(i).text;
                if (tname) serverName = strUtil.trim(tname);
            }
            var links = box.querySelectorAll("ul.content_playlist li a");
            if (!links || !links.length) {
                links = box.querySelectorAll("a");
            }
            var eps = [];
            var seen = {};
            for (var j = 0; j < links.length; j++) {
                var la = links.at(j);
                var lhref = la.getAttr("href") || "";
                if (!lhref || lhref.indexOf("javascript") === 0) continue;
                var lname = strUtil.trim(la.text || "");
                if (seen[lhref]) continue;
                seen[lhref] = 1;
                eps.push({
                    vod_name: lname || ("第" + (j + 1) + "集"),
                    vod_play_url: _absUrl(lhref),
                    need_parse: true
                });
            }
            if (eps.length) {
                result.push({ server: serverName, list: eps });
            }
        }
    } catch (e) {
        console.error("parse playlist error: " + e);
    }
    return JSON.stringify(result);
}

function parseMediaPlaylistRequest(url) {
    return JSON.stringify({
        url: url,
        request: {
            method: "get",
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" }
        }
    });
}

function parseMediaPlayUrlRequest(url, step) {
    return JSON.stringify({
        url: url,
        request: {
            method: "get",
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" }
        }
    });
}

function getMediaPlayUrlByResponse(responseText, step) {
    var playUrl = "";
    try {
        var encrypt = 0;
        var em = /"encrypt"\s*:\s*([0-9]+)/.exec(responseText);
        if (em) encrypt = parseInt(em[1]);
        var src = responseText;
        var pi = responseText.indexOf("player_aaaa");
        if (pi >= 0) src = responseText.substring(pi);
        var um = /"url"\s*:\s*"([^"]+)"/.exec(src);
        if (um) playUrl = um[1];
        playUrl = playUrl.replace(/\\\//g, "/");
        if (playUrl && (encrypt === 1 || playUrl.charAt(0) === "%")) {
            playUrl = unescape(playUrl);
        } else if (encrypt === 2) {
            playUrl = unescape(Base64.decode(playUrl));
        }
    } catch (e) {
        console.error("parse play url error: " + e);
    }
    return JSON.stringify({ vod_play_url: playUrl, need_parse: false });
}

function getMediaPlaybackOptions(url) {
    return JSON.stringify({
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            "Referer": "{{host}}/"
        }
    });
}
