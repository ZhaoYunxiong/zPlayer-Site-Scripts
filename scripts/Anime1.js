var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
var HOST = "https://anime1.me";
var API = "https://v.anime1.me/api";
var PAGE_SIZE = 20;

var _tagPage = 1;
var _apireq = "";
var _lastUrl = "";
var _tries = 0;

function getSiteInfo() {
    return JSON.stringify({
        id: "anime1",
        name: "Anime1",
        group: "影视",
        version: 1,
        host: "https://anime1.me",
        desc: "Anime1.me 動畫線上看"
    });
}

function getTagInfo() {
    return JSON.stringify([
        {
            name: "動畫列表",
            url: HOST + "/animelist.json"
        },
        {
            name: "2026年夏季新番",
            url: HOST + "/2026%E5%B9%B4%E5%A4%8F%E5%AD%A3%E6%96%B0%E7%95%AA"
        }
    ]);
}

function parseTagRequest(url, page) {
    _tagPage = parseInt(page, 10);
    if (!(_tagPage > 0)) _tagPage = 1;
    return JSON.stringify({
        url: url,
        request: {
            method: "get",
            headers: { "User-Agent": UA, "Referer": HOST + "/" }
        }
    });
}

function getMediaTagListByResponse(responseText) {
    var text = strUtil.trim(responseText || "");
    if (!text) return JSON.stringify({ pagecount: 1, list: [] });
    if (text.charAt(0) === "[") return listFromAnimelist(text);
    return listFromSeasonPage(text);
}

function listFromAnimelist(text) {
    var arr = JSON.parse(text);
    var all = [];
    for (var i = 0; i < arr.length; i++) {
        var row = arr[i];
        if (!row || row.length < 2) continue;
        var cid = row[0];
        if (cid === null || cid === undefined || cid === "") continue;
        all.push({
            id: String(cid),
            name: String(row[1] || "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, ""),
            note: String(row[2] || "")
        });
    }
    var page = _tagPage > 0 ? _tagPage : 1;
    var pagecount = Math.ceil(all.length / PAGE_SIZE);
    if (pagecount < 1) pagecount = 1;
    var start = (page - 1) * PAGE_SIZE;
    var list = [];
    for (var j = start; j < all.length && j < start + PAGE_SIZE; j++) {
        var it = all[j];
        if (!it.name) continue;
        list.push({
            vod_name: it.name,
            vod_id: HOST + "/?cat=" + it.id,
            vod_play_note: it.note
        });
    }
    return JSON.stringify({ pagecount: pagecount, list: list });
}

function listFromSeasonPage(text) {
    var doc = htmlParser.parse(text);
    var root = doc.querySelector(".entry-content");
    if (!root) root = doc;
    var anchors = root.querySelectorAll("a");
    var list = [];
    var seen = {};
    for (var i = 0; i < anchors.length; i++) {
        var a = anchors.at ? anchors.at(i) : anchors[i];
        var href = a.getAttr("href") || "";
        if (href.indexOf("?cat=") < 0) continue;
        var name = strUtil.trim(a.text || "");
        if (!name) continue;
        if (href.indexOf("http") !== 0) {
            href = HOST + (href.charAt(0) === "/" ? "" : "/") + href;
        }
        if (seen[href]) continue;
        seen[href] = 1;
        list.push({ vod_name: name, vod_id: href });
    }
    return JSON.stringify({ pagecount: 1, list: list });
}

function parseMediaPlaylistRequest(url) {
    return JSON.stringify({
        url: url,
        request: {
            method: "get",
            headers: { "User-Agent": UA, "Referer": HOST + "/" }
        }
    });
}

function getMediaPlaylistByResponse(responseText) {
    _apireq = "";
    _lastUrl = "";
    _tries = 0;
    var text = responseText || "";
    var doc = htmlParser.parse(text);
    var arts = doc.querySelectorAll("article");
    var items = [];
    var seen = {};
    for (var i = 0; i < arts.length; i++) {
        var art = arts.at ? arts.at(i) : arts[i];
        var video = art.querySelector("video");
        if (!video) continue;
        var apireq = video.getAttr("data-apireq") || "";
        if (!apireq) continue;
        var linkEl = art.querySelector("h2.entry-title a");
        var href = linkEl ? (linkEl.getAttr("href") || "") : "";
        href = href.replace(/^\s+|\s+$/g, "");
        if (!href) continue;
        if (href.indexOf("http") !== 0) {
            href = HOST + (href.charAt(0) === "/" ? "" : "/") + href;
        }
        if (seen[href]) continue;
        seen[href] = 1;
        var name = linkEl ? strUtil.trim(linkEl.text || "") : "";
        var tEl = art.querySelector("time");
        var date = tEl ? strUtil.trim(tEl.text || "") : "";
        items.push({ name: name || href, url: href, date: date, apireq: apireq });
    }
    items.sort(function (a, b) {
        if (a.date && b.date) {
            if (a.date < b.date) return -1;
            if (a.date > b.date) return 1;
        }
        return 0;
    });
    var list = [];
    for (var k = 0; k < items.length; k++) {
        list.push({
            vod_name: items[k].name,
            vod_play_url: items[k].url,
            need_parse: true
        });
    }
    return JSON.stringify([{ server: "Anime1", list: list }]);
}

function parseMediaPlayUrlRequest(url, step) {
    var u = strUtil.trim(url || "");
    if (_lastUrl !== u) {
        _lastUrl = u;
        _apireq = "";
        _tries = 0;
    }
    _tries++;
    if (_tries > 3) {
        return JSON.stringify({
            url: u,
            request: {
                method: "get",
                headers: { "User-Agent": UA, "Referer": HOST + "/" }
            }
        });
    }
    if (!_apireq) {
        return JSON.stringify({
            url: u,
            request: {
                method: "get",
                headers: { "User-Agent": UA, "Referer": HOST + "/" }
            }
        });
    }
    return JSON.stringify({
        url: API,
        preserveHost: true,
        request: {
            method: "post",
            headers: {
                "User-Agent": UA,
                "Referer": u,
                "Origin": HOST,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            data: { d: _apireq }
        }
    });
}

function getMediaPlayUrlByResponse(responseText, step) {
    var text = strUtil.trim(responseText || "");
    if (!text) {
        return JSON.stringify({ vod_play_url: _lastUrl, need_parse: _tries < 3 });
    }
    var first = text.charAt(0);
    if (first === "{") {
        var data = JSON.parse(text);
        var src = "";
        if (data && data.s && data.s.length) {
            src = data.s[0].src || data.s[0].url || "";
        } else if (data && data.src) {
            src = data.src;
        }
        if (src) {
            if (src.indexOf("//") === 0) src = "https:" + src;
            _apireq = "";
            return JSON.stringify({ vod_play_url: src, need_parse: false });
        }
        return JSON.stringify({ vod_play_url: "", need_parse: false });
    }
    var m = /data-apireq="([^"]+)"/.exec(text);
    if (m && m[1]) {
        var raw = m[1];
        var dec = raw;
        try {
            dec = decodeURIComponent(raw);
        } catch (e) {
            dec = raw;
        }
        _apireq = dec;
        return JSON.stringify({ vod_play_url: _lastUrl, need_parse: true });
    }
    return JSON.stringify({ vod_play_url: _lastUrl, need_parse: _tries < 3 });
}

function getMediaSearchRequest(keyword, page) {
    var kw = encodeURIComponent(keyword || "");
    return JSON.stringify({
        url: HOST + "/?s=" + kw,
        request: {
            method: "get",
            headers: { "User-Agent": UA, "Referer": HOST + "/" }
        }
    });
}

function getMediaSearchByResponse(responseText) {
    var doc = htmlParser.parse(responseText || "");
    var arts = doc.querySelectorAll("article");
    var list = [];
    var seen = {};
    for (var i = 0; i < arts.length; i++) {
        var art = arts.at ? arts.at(i) : arts[i];
        var linkEl = art.querySelector("h2.entry-title a");
        if (!linkEl) continue;
        var href = (linkEl.getAttr("href") || "").replace(/^\s+|\s+$/g, "");
        if (!href) continue;
        if (href.indexOf("http") !== 0) {
            href = HOST + (href.charAt(0) === "/" ? "" : "/") + href;
        }
        if (seen[href]) continue;
        seen[href] = 1;
        var name = strUtil.trim(linkEl.text || "");
        if (!name) continue;
        var tEl = art.querySelector("time");
        list.push({
            vod_name: name,
            vod_id: href,
            vod_time: tEl ? strUtil.trim(tEl.text || "") : ""
        });
    }
    return JSON.stringify({ pagecount: 1, list: list });
}
