function getSiteInfo() {
    return JSON.stringify({
        id: "dmmiku",
        name: "动漫MIKU",
        group: "影视",
        version: 1,
        host: "https://www.dmmiku.com",
        desc: "动漫MIKU - 在线动漫播放",
        showHost: true
    });
}

var HOST = "https://www.dmmiku.com";

function absUrl(u) {
    if (!u) return "";
    u = String(u).replace(/^\s+|\s+$/g, "");
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    if (u.indexOf("//") === 0) return "https:" + u;
    if (u.charAt(0) !== "/") u = "/" + u;
    return HOST + u;
}

function getTagInfo() {
    var tags = [
        { name: "新番", url: HOST + "/index.php/vod/type/id/22.html" },
        { name: "完结", url: HOST + "/index.php/vod/type/id/20.html" },
        { name: "最近更新", url: HOST + "/index.php/map/index.html" },
        { name: "新番·奇幻", url: HOST + "/index.php/vod/show/class/奇幻/id/22.html" },
        { name: "新番·恋爱", url: HOST + "/index.php/vod/show/class/恋爱/id/22.html" },
        { name: "新番·后宫", url: HOST + "/index.php/vod/show/class/后宫/id/22.html" },
        { name: "新番·学園", url: HOST + "/index.php/vod/show/class/学園/id/22.html" },
        { name: "新番·热血", url: HOST + "/index.php/vod/show/class/热血/id/22.html" },
        { name: "完结·BD无修", url: HOST + "/index.php/vod/show/class/BD无修/id/20.html" },
        { name: "完结·奇幻", url: HOST + "/index.php/vod/show/class/奇幻/id/20.html" }
    ];
    return JSON.stringify(tags);
}

function parseTagRequest(url, page) {
    var p = parseInt(page || 1, 10);
    if (!p || p < 1) p = 1;
    var reqUrl = url;
    if (p > 1) {
        reqUrl = url.replace(/(\.html)$/, "/page/" + p + "$1");
    }
    return JSON.stringify({
        url: reqUrl,
        request: {
            method: "get",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            }
        }
    });
}

function parseList(html) {
    var doc = htmlParser.parse(html);
    var list = [];
    var items = doc.querySelectorAll("li.vodlist_item");
    for (var i = 0; i < items.length; i++) {
        var li = items.at(i);
        var a = li.querySelector("a.vodlist_thumb");
        if (!a) continue;
        var href = a.getAttr("href") || "";
        if (href.indexOf("/vod/detail/") < 0) continue;
        var titleA = li.querySelector("p.vodlist_title a");
        var name = titleA ? strUtil.trim(titleA.text) : strUtil.trim(a.getAttr("title") || "");
        if (!name) continue;
        var img = li.querySelector("img");
        var pic = "";
        if (img) {
            pic = img.getAttr("data-original") || img.getAttr("data-src") || img.getAttr("src") || "";
        }
        if (!pic && a.getAttr("data-original")) pic = a.getAttr("data-original");
        var noteEl = li.querySelector("span.pic_text");
        var note = noteEl ? strUtil.trim(noteEl.text) : "";
        var subEl = li.querySelector("p.vodlist_sub");
        var sub = subEl ? strUtil.trim(subEl.text) : "";
        list.push({
            vod_name: name,
            vod_id: absUrl(href),
            vod_pic: absUrl(pic),
            vod_play_note: note,
            vod_time: sub
        });
    }
    var pagecount = 1;
    var pageLinks = doc.querySelectorAll("a");
    for (var j = 0; j < pageLinks.length; j++) {
        var ph = pageLinks.at(j).getAttr("href") || "";
        var m = /\/page\/(\d+)\.html/.exec(ph);
        if (m) {
            var n = parseInt(m[1], 10);
            if (n > pagecount) pagecount = n;
        }
    }
    return { pagecount: pagecount, list: list };
}

function getMediaTagListByResponse(responseText) {
    return JSON.stringify(parseList(responseText));
}

function getMediaSearchRequest(keyword, page) {
    var p = parseInt(page || 1, 10);
    if (!p || p < 1) p = 1;
    var url = HOST + "/index.php/vod/search.html?wd=" + encodeURIComponent(keyword);
    if (p > 1) url = HOST + "/index.php/vod/search/page/" + p + "/wd/" + encodeURIComponent(keyword) + ".html";
    return JSON.stringify({
        url: url,
        request: {
            method: "get",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            }
        }
    });
}

function getMediaSearchByResponse(responseText) {
    return JSON.stringify(parseList(responseText));
}

function parseMediaPlaylistRequest(url) {
    return JSON.stringify({
        url: url,
        request: {
            method: "get",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            }
        }
    });
}

function cleanText(s) {
    if (!s) return "";
    // 去掉 iconfont 私有区字符与不可见符号
    s = String(s).replace(/[\uE000-\uF8FF]/g, "");
    s = s.replace(/[\u00A0\u3000\s]+/g, " ");
    return s.replace(/^\s+|\s+$/g, "");
}

function getMediaPlaylistByResponse(responseText) {
    var doc = htmlParser.parse(responseText);
    var groups = [];
    var boxes = doc.querySelectorAll("div.play_list_box");
    var tabs = doc.querySelectorAll("div.play_source_tab a");
    for (var i = 0; i < boxes.length; i++) {
        var server = "线路" + (i + 1);
        if (tabs.length > i) {
            var tn = cleanText(tabs.at(i).text);
            if (tn) server = tn;
        }
        var eps = [];
        var seen = {};
        var links = boxes.at(i).querySelectorAll("ul.content_playlist li a");
        for (var j = 0; j < links.length; j++) {
            var a = links.at(j);
            var href = a.getAttr("href") || "";
            if (!/\/vod\/play\/id\/\d+\/sid\/\d+\/nid\/\d+\.html/.test(href)) continue;
            var nm = cleanText(a.text);
            if (!nm) continue;
            var full = absUrl(href);
            if (seen[full]) continue;
            seen[full] = true;
            eps.push({ vod_name: nm, vod_play_url: full, need_parse: true });
        }
        if (eps.length > 0) groups.push({ server: server, list: eps });
    }
    return JSON.stringify(groups);
}

function parseMediaPlayUrlRequest(url, step) {
    return JSON.stringify({
        url: url,
        request: {
            method: "get",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0"
            }
        }
    });
}

function getMediaPlayUrlByResponse(responseText, step) {
    var m = /var\s+player_aaaa\s*=\s*(\{[\s\S]*?\})\s*<\/script>/.exec(responseText);
    if (!m) m = /var\s+player_aaaa\s*=\s*(\{[\s\S]*?\});/.exec(responseText);
    if (!m) return JSON.stringify({ vod_play_url: "", need_parse: false });
    var text = m[1];
    var url = "";
    var um = /"url"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text);
    if (um) url = um[1].replace(/\\\//g, "/").replace(/\\\\/g, "\\");
    var encrypt = 0;
    var em = /"encrypt"\s*:\s*(\d+)/.exec(text);
    if (em) encrypt = parseInt(em[1], 10);
    if (encrypt === 2) {
        url = unescape(Base64.decode(url));
    } else if (encrypt === 1) {
        url = unescape(url);
    }
    if (url && /^https?:\/\//i.test(url)) {
        return JSON.stringify({ vod_play_url: url, need_parse: false });
    }
    return JSON.stringify({ vod_play_url: "", need_parse: false });
}

function getMediaPlaybackOptions(url) {
    return JSON.stringify({
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Referer": HOST + "/"
        }
    });
}
