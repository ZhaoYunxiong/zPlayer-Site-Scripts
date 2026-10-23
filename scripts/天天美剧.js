var SITE_HOST = "https://www.mjttk.cc";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function getSiteInfo() {
    return JSON.stringify({
        id: "mjttk",
        name: "天天美剧",
        group: "影视",
        version: 1,
        host: "https://www.mjttk.cc",
        desc: "天天美剧，美剧迷的美剧天堂；当前版本提供已确认支持的 WJ线路。"
    });
}

function getTagInfo() {
    return JSON.stringify([
        { name: "美剧", url: "https://www.mjttk.cc/type/oumei.html" },
        { name: "韩剧", url: "https://www.mjttk.cc/type/hanguo.html" },
        { name: "日剧", url: "https://www.mjttk.cc/type/riben.html" },
        { name: "电影", url: "https://www.mjttk.cc/type/dianying.html" },
        { name: "动漫番剧", url: "https://www.mjttk.cc/type/dongman.html" },
        { name: "综艺节目", url: "https://www.mjttk.cc/zongyi.html" },
        { name: "全部影片", url: "https://www.mjttk.cc/dianshiju.html" }
    ]);
}

// 分类页翻页格式：/type/oumei.html -> /type/oumei_2.html
function parseTagRequest(url, page) {
    page = parseInt(page, 10) || 1;
    var target = url;
    if (page > 1) target = url.replace(/\.html$/, "_" + page + ".html");
    return JSON.stringify({
        url: target,
        request: { method: "get", headers: { "User-Agent": UA } }
    });
}

function getMediaTagListByResponse(responseText) {
    var doc = htmlParser.parse(responseText);
    var items = doc.querySelectorAll("div.module-item");
    var list = [];
    for (var i = 0; i < items.length; i++) {
        var it = items.at(i);
        var a = it.querySelector(".module-item-title");
        if (!a) continue;
        var href = a.getAttr("href") || "";
        var name = a.getAttr("title") || a.text || "";
        if (!href || !name) continue;
        var picEl = it.querySelector(".module-item-pic img");
        var pic = "";
        if (picEl) pic = picEl.getAttr("data-original") || picEl.getAttr("src") || "";
        var noteEl = it.querySelector(".module-item-text");
        list.push({
            vod_name: name,
            vod_id: href.indexOf("http") === 0 ? href : SITE_HOST + href,
            vod_pic: pic,
            vod_play_note: noteEl ? noteEl.text : ""
        });
    }
    var pagecount = 1;
    var pc = /page-number[^>]*>\s*(\d+)\s*\/\s*(\d+)\s*</.exec(responseText);
    if (pc) pagecount = parseInt(pc[2], 10);
    return JSON.stringify({ pagecount: pagecount, list: list });
}

function parseMediaPlaylistRequest(url) {
    return JSON.stringify({
        url: url,
        request: { method: "get", headers: { "User-Agent": UA } }
    });
}

// 详情页分集：只返回已确认可播的第一条线路（WJ线路）。
// 分集链接结构：/play/{vodId}-{sid}-{nid}.html
function getMediaPlaylistByResponse(responseText) {
    var block = "";
    var pos = -1;
    while (true) {
        pos = responseText.indexOf("module-blocklist", pos + 1);
        if (pos < 0) return JSON.stringify([]);
        var next = responseText.indexOf("module-blocklist", pos + 5);
        block = responseText.substring(pos, next > pos ? next : responseText.length);
        if (/href="\/play\/\d+-\d+-\d+\.html"/.test(block)) break;
    }
    var re = /<a\s[^>]*href="(\/play\/\d+-\d+-\d+\.html)"[^>]*>([\s\S]*?)<\/a>/g;
    var sid = "";
    var eps = [];
    var m;
    while ((m = re.exec(block)) !== null) {
        var href = m[1];
        var sm = /\/play\/\d+-(\d+)-\d+\.html/.exec(href);
        var curSid = sm ? sm[1] : "";
        if (!sid) sid = curSid;
        if (curSid !== sid) continue;
        var nm = /<sapn>([^<]*)<\/sapn>/.exec(m[2]);
        var name = nm ? nm[1] : "";
        if (!name) {
            var tm = /title='([^']*)'/.exec(m[0]);
            if (tm) name = tm[1].replace(/^播放/, "");
        }
        if (!name) continue;
        eps.push({ name: name, url: SITE_HOST + href });
    }
    if (!eps.length) return JSON.stringify([]);
    var tabm = /module-tab-item[^>]*data-dropdown-value="([^"]+)"/.exec(responseText);
    var server = tabm ? tabm[1] : "线路1";
    var list = [];
    for (var j = 0; j < eps.length; j++) {
        list.push({ vod_name: eps[j].name, vod_play_url: eps[j].url, need_parse: true });
    }
    return JSON.stringify([{ server: server, list: list }]);
}

function parseMediaPlayUrlRequest(url, step) {
    return JSON.stringify({
        url: url,
        request: { method: "get", headers: { "User-Agent": UA } }
    });
}

// 播放页内置播放器 iframe：https://www.shankubf.com/m3u8/?url=<真实m3u8地址>
function getMediaPlayUrlByResponse(responseText, step) {
    var m = /<iframe[^>]*id="playPath"[^>]*src="([^"]+)"/.exec(responseText);
    if (!m) return JSON.stringify({ vod_play_url: "", need_parse: false });
    var src = m[1].replace(/&amp;/g, "&");
    var idx = src.indexOf("url=");
    var real = idx >= 0 ? src.substring(idx + 4) : src;
    if (real.indexOf("://") === -1) {
        try { real = decodeURIComponent(real); } catch (e) { }
    }
    if (!/^https?:\/\//i.test(real)) real = "";
    return JSON.stringify({ vod_play_url: real, need_parse: false });
}
