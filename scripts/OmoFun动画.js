function getSiteInfo() {
    return JSON.stringify({
        id: "omofun",
        name: "OmoFun动画",
        group: "影视",
        version: 1,
        host: "https://www.omofuns.com",
        desc: "OmoFun动漫分类与详情解析，当前支持暴风线路",
        showHost: true
    });
}

var OMO_HOST = "https://www.omofuns.com";
var OMO_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
// 仅暴露已实测可读取媒体的线路（页面 tab 名称）
var OMO_ROUTES = ["暴风"];

function omoAbsUrl(u) {
    u = String(u || "");
    if (!u) return "";
    if (u.indexOf("http://") === 0 || u.indexOf("https://") === 0) return u;
    if (u.indexOf("//") === 0) return "https:" + u;
    if (u.charAt(0) !== "/") u = "/" + u;
    return OMO_HOST + u;
}

function getTagInfo() {
    var tags = [
        { name: "日漫", id: 1 },
        { name: "国漫", id: 2 },
        { name: "动画", id: 5 },
        { name: "剧场", id: 24 },
        { name: "特摄", id: 4 },
        { name: "美漫", id: 3 }
    ];
    var list = [];
    for (var i = 0; i < tags.length; i++) {
        list.push({
            name: tags[i].name,
            url: OMO_HOST + "/type/" + tags[i].id + "-{{page}}.html"
        });
    }
    return JSON.stringify(list);
}

function getMediaTagListByResponse(responseText) {
    var text = String(responseText || "");
    var doc = htmlParser.parse(text);
    var items = doc.querySelectorAll("ul.BIaC_ACJijja > li");
    var list = [];
    for (var i = 0; i < items.length; i++) {
        var li = items[i];
        var link = li.querySelector("div.BIaC_ACJijja__DEF > a.BIaC_ACJijja__JCEEj");
        if (!link) link = li.querySelector("h4.title a");
        if (!link) continue;
        var href = link.getAttr("href") || "";
        if (!/^\/anime\/[0-9a-zA-Z]+\.html$/.test(href)) continue;
        var name = link.getAttr("title") || "";
        if (!name) name = String(link.text || "").replace(/[\s\u00a0]+/g, "");
        if (!name) continue;
        var pic = link.getAttr("data-original") || link.getAttr("data-src") || "";
        var noteEl = li.querySelector("span.CCh_IAFJ");
        var note = noteEl ? String(noteEl.text || "").replace(/[\s\u00a0]+/g, "") : "";
        list.push({
            vod_name: name,
            vod_id: omoAbsUrl(href),
            vod_pic: pic,
            vod_play_note: note
        });
    }

    var pagecount = 1;
    var links = doc.querySelectorAll("a[href]");
    for (var k = 0; k < links.length; k++) {
        var h = links[k].getAttr("href") || "";
        var m = /^\/type\/\d+-(\d+)\.html$/.exec(h);
        if (m) {
            var n = parseInt(m[1], 10);
            if (n > pagecount) pagecount = n;
        }
    }

    return JSON.stringify({ pagecount: pagecount, list: list });
}

// 从详情页 tab 栏提取 “sid -> 线路名”，保持页面出现顺序
function omoParseRoutes(text) {
    var routes = [];
    var seen = {};
    var re = /<a[^>]+href="#playlist(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
    var m;
    while ((m = re.exec(text)) !== null) {
        var sid = m[1];
        if (seen[sid]) continue;
        var inner = m[2] || "";
        inner = inner.replace(/<span[\s\S]*?<\/span>/gi, "");
        inner = inner.replace(/<[^>]+>/g, "");
        inner = inner.replace(/[\s\u00a0]+/g, "");
        inner = inner.replace(/[（(]\s*共?\d+\s*集?\s*[)）]/g, "");
        if (!inner) continue;
        seen[sid] = 1;
        routes.push({ sid: sid, name: inner });
    }
    return routes;
}

function getMediaPlaylistByResponse(responseText) {
    var text = String(responseText || "");
    var routes = omoParseRoutes(text);
    var doc = htmlParser.parse(text);
    var groups = [];

    for (var i = 0; i < routes.length; i++) {
        var sid = routes[i].sid;
        var routeName = routes[i].name;
        if (OMO_ROUTES.indexOf(routeName) < 0) continue;

        var reLink = new RegExp("^/anime/[0-9a-zA-Z]+/play/" + sid + "/\\d+\\.html$");
        var anchors = doc.querySelectorAll("#playlist" + sid + " a[href]");
        var eps = [];
        var seen = {};
        for (var j = 0; j < anchors.length; j++) {
            var a = anchors[j];
            var href = a.getAttr("href") || "";
            if (!reLink.test(href)) continue;
            if (seen[href]) continue;
            var epName = String(a.text || "").replace(/[\s\u00a0]+/g, "");
            if (!epName) epName = String(a.getAttr("title") || "").replace(/[\s\u00a0]+/g, "");
            if (!epName || epName.indexOf("立即播放") >= 0) continue;
            seen[href] = 1;
            eps.push({
                vod_name: epName,
                vod_play_url: omoAbsUrl(href),
                need_parse: true
            });
        }
        if (eps.length === 0) continue;
        groups.push({ server: routeName, list: eps });
    }

    return JSON.stringify(groups);
}

function omoPctDecode(s) {
    s = String(s || "");
    var out = "";
    var bytes = [];
    var i = 0;
    function flush() {
        if (!bytes.length) return;
        var j = 0;
        while (j < bytes.length) {
            var b = bytes[j];
            var code = -1;
            if (b < 0x80) { code = b; j += 1; }
            else if ((b & 0xE0) === 0xC0 && j + 1 < bytes.length) {
                code = ((b & 0x1F) << 6) | (bytes[j + 1] & 0x3F); j += 2;
            } else if ((b & 0xF0) === 0xE0 && j + 2 < bytes.length) {
                code = ((b & 0x0F) << 12) | ((bytes[j + 1] & 0x3F) << 6) | (bytes[j + 2] & 0x3F); j += 3;
            } else if ((b & 0xF8) === 0xF0 && j + 3 < bytes.length) {
                code = ((b & 0x07) << 18) | ((bytes[j + 1] & 0x3F) << 12) | ((bytes[j + 2] & 0x3F) << 6) | (bytes[j + 3] & 0x3F); j += 4;
            } else { code = b; j += 1; }
            out += String.fromCharCode(code);
        }
        bytes = [];
    }
    while (i < s.length) {
        var c = s.charAt(i);
        if (c === "%" && (s.charAt(i + 1) === "u" || s.charAt(i + 1) === "U") && i + 5 < s.length) {
            flush();
            out += String.fromCharCode(parseInt(s.substr(i + 2, 4), 16));
            i += 6;
        } else if (c === "%" && i + 2 < s.length && /^[0-9a-fA-F]{2}$/.test(s.substr(i + 1, 2))) {
            bytes.push(parseInt(s.substr(i + 1, 2), 16));
            i += 3;
        } else {
            flush();
            out += c;
            i += 1;
        }
    }
    flush();
    return out;
}

function parseMediaPlayUrlRequest(url, step) {
    return JSON.stringify({
        url: omoAbsUrl(url),
        request: {
            method: "get",
            headers: {
                "User-Agent": OMO_UA,
                "Referer": omoAbsUrl(url)
            }
        }
    });
}

function getMediaPlayUrlByResponse(responseText, step) {
    var text = String(responseText || "");
    var mark = text.indexOf("player_aaaa=");
    if (mark < 0) return JSON.stringify({ vod_play_url: "", need_parse: false });

    var end = text.indexOf("</script>", mark);
    if (end < 0) end = text.length;
    var jsonText = text.substring(mark + "player_aaaa=".length, end);
    jsonText = jsonText.replace(/;\s*$/, "");
    jsonText = jsonText.replace(/^\s+|\s+$/g, "");

    var data;
    try {
        data = JSON.parse(jsonText);
    } catch (e) {
        return JSON.stringify({ vod_play_url: "", need_parse: false });
    }

    var playUrl = String(data.url || "");
    var encrypt = parseInt(data.encrypt || 0, 10);
    if (encrypt === 1 || playUrl.charAt(0) === "%") {
        playUrl = omoPctDecode(playUrl);
    } else if (encrypt === 2) {
        playUrl = omoPctDecode(Base64.decode(playUrl));
    }

    if (/[^\x00-\x7F]/.test(playUrl)) {
        playUrl = encodeURI(playUrl);
    }

    return JSON.stringify({ vod_play_url: playUrl, need_parse: false });
}
