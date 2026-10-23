function getSiteInfo() {
    return JSON.stringify({
        id: "yinghuadm-acd",
        name: "樱花动漫ACD",
        group: "影视",
        version: 1,
        host: "http://m.yinghuadm.io",
        desc: "樱花动漫移动版，动漫在线观看",
        showHost: true
    });
}

var UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

var HOST = "http://m.yinghuadm.io";

// 记录上一次分类/搜索请求的页码，用于计算 pagecount
var __listPage = 1;

function getTagInfo() {
    var tags = [
        { name: "日本动漫", url: "{{host}}/japan/" },
        { name: "国产动漫", url: "{{host}}/guochandongman/" },
        { name: "欧美动漫", url: "{{host}}/meiguodongman/" },
        { name: "动漫电影", url: "{{host}}/movie/" },
        { name: "亲子动漫", url: "{{host}}/qinzi/" },
        { name: "2024新番", url: "{{host}}/2024/" }
    ];
    return JSON.stringify(tags);
}

function absUrl(href) {
    if (!href) return "";
    if (href.indexOf("//") === 0) return "http:" + href;
    if (href.indexOf("http") === 0) return href;
    if (href.charAt(0) !== "/") return HOST + "/" + href;
    return HOST + href;
}

function safeDecode(s) {
    if (!s) return "";
    return s.replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

// 分类页按第一页为目录、第二页起为 {page}.html
function buildListUrl(url, page) {
    var p = parseInt(page, 10);
    if (isNaN(p) || p < 1) p = 1;
    __listPage = p;
    var u = url;
    u = u.replace(/^https?:\/\/[^\/]+/, "");
    u = u.replace(/\{\{host\}\}/g, "");
    u = u.replace(/\/\{\{page\}\}\.html$/, "/");
    u = u.replace(/\/\d+\.html$/, "/");
    if (u.charAt(0) !== "/") u = "/" + u;
    if (u.charAt(u.length - 1) !== "/") u = u + "/";
    if (p > 1) u = u + p + ".html";
    return HOST + u;
}

function parseTagRequest(url, page) {
    var u = buildListUrl(url, page);
    return JSON.stringify({
        url: u,
        request: {
            method: "get",
            headers: {
                "User-Agent": UA,
                "Referer": HOST + "/"
            }
        }
    });
}

function parseCount(doc) {
    var pageEl = doc.querySelector("div.pages");
    var count = __listPage;
    if (pageEl) {
        var html = pageEl.outerHTML || pageEl.innerHTML || "";
        var re = /\/(\d+)\.html/g;
        var m;
        while ((m = re.exec(html)) !== null) {
            var n = parseInt(m[1], 10);
            if (n > count) count = n;
        }
        if (count === __listPage && html.indexOf("下一页") >= 0) count = __listPage + 1;
    }
    return count;
}

function parseMediaItems(responseText) {
    var doc = htmlParser.parse(responseText);
    var items = doc.querySelectorAll("li.item");
    var list = [];
    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var a = it.querySelector("a.itemtext");
        if (!a) continue;
        var href = a.getAttr("href") || "";
        if (!/\/show\/\d+\.html/.test(href)) continue;
        var name = a.text.trim();
        if (!name) continue;
        var noteEl = it.querySelector(".itemimgtext");
        var note = noteEl ? noteEl.text.trim() : "";
        var pic = "";
        var block = it.querySelector(".imgblock");
        if (block) {
            var style = block.getAttr("style") || "";
            var mm = /url\(['"]?([^'")]+)/.exec(style);
            if (mm) pic = mm[1];
        }
        if (!pic) {
            var img = it.querySelector(".imgblock img") || it.querySelector("img");
            if (img) {
                var src = img.getAttr("src") || "";
                if (src && src.indexOf("pic.png") < 0) pic = absUrl(src);
            }
        }
        list.push({
            vod_name: name,
            vod_id: absUrl(href),
            vod_pic: pic,
            vod_play_note: note,
            vod_time: ""
        });
    }
    return { pagecount: parseCount(doc), list: list };
}

function getMediaTagListByResponse(responseText) {
    return JSON.stringify(parseMediaItems(responseText));
}

function getMediaSearchRequest(keyword, page) {
    var kw = encodeURIComponent(keyword);
    return JSON.stringify({
        url: HOST + "/search/" + kw + "/",
        request: {
            method: "get",
            headers: {
                "User-Agent": UA,
                "Referer": HOST + "/"
            }
        }
    });
}

function getMediaSearchByResponse(responseText) {
    __listPage = 1;
    return JSON.stringify(parseMediaItems(responseText));
}

function parseMediaPlaylistRequest(url) {
    return JSON.stringify({
        url: url,
        request: {
            method: "get",
            headers: {
                "User-Agent": UA,
                "Referer": HOST + "/"
            }
        }
    });
}

// 分集名称：容器内多为纯数字，统一显示为“第N集”；已有中文名称的保持原样
function epName(text) {
    var t = (text || "").trim();
    if (!t) return "";
    if (/^\d+$/.test(t)) return "第" + t + "集";
    return t;
}

function getMediaPlaylistByResponse(responseText) {
    var doc = htmlParser.parse(responseText);
    var box = doc.querySelector("#playlists");
    if (!box) return JSON.stringify([]);
    var links = box.querySelectorAll("li a");
    var list = [];
    var seen = {};
    for (var i = 0; i < links.length; i++) {
        var a = links[i];
        var href = a.getAttr("href") || "";
        if (!/^\/v\/\d+-\d+\.html/.test(href)) continue;
        var name = epName(a.text);
        if (!name) continue;
        var full = absUrl(href);
        if (seen[full]) continue;
        seen[full] = 1;
        list.push({
            vod_name: name,
            vod_play_url: full,
            need_parse: true
        });
    }
    if (list.length === 0) return JSON.stringify([]);
    return JSON.stringify([{ server: "线路1", list: list }]);
}

function parseMediaPlayUrlRequest(url, step) {
    return JSON.stringify({
        url: url,
        preserveHost: true,
        request: {
            method: "get",
            headers: {
                "User-Agent": UA,
                "Referer": HOST + "/"
            }
        }
    });
}

function getMediaPlayUrlByResponse(responseText, step) {
    // 播放页：容器带 data-vid
    var box = /data-vid="([^"]*)"/.exec(responseText);
    if (box) {
        var rawVid = safeDecode(box[1]);
        var gf = /data-gf=['"]?(\d)/.exec(responseText);
        var mv = /data-m="(\d)"/.exec(responseText);
        var isGf = gf ? gf[1] === "1" : false;
        // data-vid 尾部形如 "$mp4"，为播放器标记而非地址的一部分
        var plain = rawVid.replace(/\$[A-Za-z0-9]+$/, "");
        if (!isGf && /^https?:\/\//.test(plain)) {
            return JSON.stringify({ vod_play_url: plain, need_parse: false });
        }
        var playerUrl = "https://tup.yinghuadm.io/?vid=" + encodeURIComponent(rawVid);
        if (mv && mv[1] === "1") playerUrl += "&m=1";
        return JSON.stringify({ vod_play_url: playerUrl, need_parse: true });
    }
    // 内嵌播放器页面：从 DPlayer 配置读取视频地址
    var m = /url\s*:\s*["']([^"']+)["']/.exec(responseText);
    if (!m) m = /data-src="([^"]+)"/.exec(responseText);
    if (!m) m = /<source[^>]+src="([^"]+)"/.exec(responseText);
    if (m) {
        return JSON.stringify({ vod_play_url: safeDecode(m[1]), need_parse: false });
    }
    return JSON.stringify({ vod_play_url: "", need_parse: false });
}
