var SITE_HOST = "https://fcccc.cc";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function getSiteInfo() {
    return JSON.stringify({
        id: "fengche",
        name: "风车动漫",
        group: "影视",
        version: 1,
        desc: "风车动漫 - 专注动漫的门户网站，海量日漫、国漫、美漫、剧场版免费在线观看",
        host: "https://fcccc.cc",
        showHost: true
    });
}

function getTagInfo() {
    return JSON.stringify([
        { name: "日漫", url: "{{host}}/k/1/" },
        { name: "国漫", url: "{{host}}/k/2/" },
        { name: "美漫", url: "{{host}}/k/3/" },
        { name: "动漫剧场", url: "{{host}}/k/20/" }
    ]);
}

/* ---------------- 工具函数 ---------------- */

function trimText(s) {
    if (!s) return "";
    return String(s).replace(/^[\s\u3000]+/g, "").replace(/[\s\u3000]+$/g, "");
}

function flatText(s) {
    if (!s) return "";
    return trimText(String(s).replace(/[\s\u3000]+/g, " "));
}

function absoluteUrl(href) {
    if (!href) return "";
    href = String(href).replace(/\\\//g, "/");
    if (/^https?:\/\//i.test(href)) return href;
    if (href.charAt(0) === "/") return SITE_HOST + href;
    return SITE_HOST + "/" + href;
}

function fixEscapes(s) {
    if (!s) return "";
    return String(s).replace(/\\\//g, "/").replace(/\\u002[fF]/g, "/").replace(/&amp;/g, "&");
}

function parsePageCount(html) {
    var m = /共[\s\u3000]*\d+[\s\u3000]*\/[\s\u3000]*(\d+)[\s\u3000]*页/.exec(html);
    if (m) {
        var n = parseInt(m[1], 10);
        if (n > 0) return n;
    }
    var max = 1;
    var re = /[\/-](\d+)\/page\//g;
    var mm;
    while ((mm = re.exec(html)) !== null) {
        var v = parseInt(mm[1], 10);
        if (v > max) max = v;
    }
    return max;
}

function parseMediaList(html) {
    var doc = htmlParser.parse(html);
    var nodes = doc.querySelectorAll("article.u-movie");
    if (!nodes || nodes.length === 0) nodes = doc.querySelectorAll(".u-movie");
    if (!nodes || nodes.length === 0) nodes = doc.querySelectorAll(".list-poster");
    var list = [];
    var seen = {};
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var a = node.querySelector("a");
        if (!a) continue;
        var href = a.getAttr("href") || "";
        if (!href || href.indexOf("javascript") === 0) continue;
        var vodId = absoluteUrl(href);
        if (seen[vodId]) continue;
        seen[vodId] = true;
        var name = a.getAttr("title") || "";
        if (!name) {
            var h2 = node.querySelector("h2");
            if (h2) name = h2.text;
        }
        var pic = "";
        var img = node.querySelector("img");
        if (img) pic = img.getAttr("data-original") || img.getAttr("src") || "";
        var note = "";
        var st = node.querySelector(".zhuangtai");
        if (st) note = st.text;
        var time = "";
        var meta = node.querySelector(".meta");
        if (meta) time = meta.text;
        list.push({
            vod_name: flatText(name),
            vod_id: vodId,
            vod_pic: absoluteUrl(pic),
            vod_play_note: flatText(note),
            vod_time: flatText(time)
        });
    }
    return list;
}

/* ---------------- 分类列表 ---------------- */

function parseTagRequest(url, page) {
    page = page || 1;
    var target = String(url).replace("{{host}}", SITE_HOST).replace("{{page}}", page);
    if (page > 1) {
        target = target.replace(/(\d+)\/$/, "$1-" + page + "/");
    }
    return JSON.stringify({
        url: target,
        request: {
            method: "get",
            headers: { "User-Agent": USER_AGENT, "Referer": SITE_HOST + "/" }
        }
    });
}

function getMediaTagListByResponse(responseText) {
    console.log("风车动漫分类页长度：" + (responseText ? responseText.length : -1));
    var list = parseMediaList(responseText || "");
    console.log("风车动漫分类解析数量：" + list.length);
    return JSON.stringify({
        pagecount: parsePageCount(responseText || ""),
        list: list
    });
}

/* ---------------- 搜索 ---------------- */

function getMediaSearchRequest(keyword, page) {
    page = page || 1;
    var kw = encodeURIComponent(keyword);
    var url = SITE_HOST + "/u/?wd=" + kw;
    if (page > 1) {
        url = SITE_HOST + "/u" + kw + "/page/" + page + "/";
    }
    return JSON.stringify({
        url: url,
        request: {
            method: "get",
            headers: { "User-Agent": USER_AGENT, "Referer": SITE_HOST + "/" }
        }
    });
}

function getMediaSearchByResponse(responseText) {
    return JSON.stringify({
        pagecount: parsePageCount(responseText),
        list: parseMediaList(responseText)
    });
}

/* ---------------- 详情页分集 ---------------- */

function parseMediaPlaylistRequest(url) {
    return JSON.stringify({
        url: absoluteUrl(url),
        request: {
            method: "get",
            headers: { "User-Agent": USER_AGENT, "Referer": SITE_HOST + "/" }
        }
    });
}

function buildEpisodes(container, seen) {
    var eps = [];
    if (!container) return eps;
    var anchors = container.querySelectorAll("a");
    if (!anchors) return eps;
    for (var i = 0; i < anchors.length; i++) {
        var href = anchors[i].getAttr("href") || "";
        if (!/\/v\/\d+[-_]\d+[-_]\d+/.test(href)) continue;
        var playUrl = absoluteUrl(href);
        if (seen[playUrl]) continue;
        seen[playUrl] = true;
        var name = flatText(anchors[i].text);
        if (!name) name = "第" + (eps.length + 1) + "集";
        eps.push({ vod_name: name, vod_play_url: playUrl, need_parse: true });
    }
    return eps;
}

function getMediaPlaylistByResponse(responseText) {
    var doc = htmlParser.parse(responseText);
    var boxes = doc.querySelectorAll("#video_list_li");
    if (!boxes || boxes.length === 0) boxes = doc.querySelectorAll(".video_list_li");
    var groups = [];
    var seen = {};
    if (boxes) {
        for (var i = 0; i < boxes.length; i++) {
            var eps = buildEpisodes(boxes[i], seen);
            if (eps.length > 0) {
                groups.push({ server: "线路" + (groups.length + 1), list: eps });
            }
        }
    }
    if (groups.length === 0) {
        var eps2 = buildEpisodes(doc, seen);
        if (eps2.length > 0) groups.push({ server: "线路1", list: eps2 });
    }
    return JSON.stringify(groups);
}

/* ---------------- 播放地址解析 ---------------- */

function decodePlayUrl(raw, encrypt) {
    var playUrl = fixEscapes(raw);
    if (!playUrl) return "";
    if (encrypt === 1) {
        try { playUrl = unescape(playUrl); } catch (e) { }
    } else if (encrypt === 2) {
        try { playUrl = unescape(Base64.decode(playUrl)); } catch (e) { }
    } else if (playUrl.charAt(0) === "%") {
        try { playUrl = unescape(playUrl); } catch (e) { }
    }
    return fixEscapes(playUrl);
}

function parseMediaPlayUrlRequest(url, step) {
    return JSON.stringify({
        url: absoluteUrl(url),
        request: {
            method: "get",
            headers: { "User-Agent": USER_AGENT, "Referer": SITE_HOST + "/" }
        }
    });
}

function getMediaPlayUrlByResponse(responseText, step) {
    var playUrl = "";
    var encrypt = 0;
    var m = /player_aaaa\s*=\s*(\{[\s\S]*?\})\s*;/.exec(responseText);
    if (!m) m = /player_aaaa\s*=\s*(\{[\s\S]*?\})</.exec(responseText);
    if (m) {
        var jsonText = m[1];
        var um = /"url"\s*:\s*"([^"]*)"/.exec(jsonText);
        if (um) playUrl = um[1];
        var em = /"encrypt"\s*:\s*([0-9]+)/.exec(jsonText);
        if (em) encrypt = parseInt(em[1], 10);
        playUrl = decodePlayUrl(playUrl, encrypt);
    }
    if (!playUrl) {
        var m2 = /(https?:[\\\/]{1,2}[^"'\s,]+?\.(?:m3u8|mp4)[^"'\s,]*)/.exec(responseText);
        if (m2) playUrl = fixEscapes(m2[1]);
    }
    if (!playUrl) {
        var m3 = /"url"\s*:\s*"([^"]+\.(?:m3u8|mp4)[^"]*)"/.exec(responseText);
        if (m3) playUrl = decodePlayUrl(m3[1], 0);
    }
    console.log("风车动漫播放地址：" + playUrl);
    return JSON.stringify({ vod_play_url: playUrl, need_parse: false });
}

function getMediaPlaybackOptions(url) {
    return JSON.stringify({
        headers: {
            "User-Agent": USER_AGENT,
            "Referer": SITE_HOST + "/"
        }
    });
}
