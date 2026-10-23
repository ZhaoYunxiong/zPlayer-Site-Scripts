/**
 * 美剧天堂
 * 站点已更换域名（旧域 716pt.com 已无 DNS 解析），页面本身提示“旧域名已失效”，
 * 现用域名为 www.meijutt.cc，模板结构按新域名模板重新对照。
 */

var SITE_HOST = "https://www.meijutt.cc";

function getSiteInfo() {
    return JSON.stringify({
        id: "meijutt",
        name: "美剧天堂",
        group: "影视",
        host: "https://www.meijutt.cc",
        version: 3,
        desc: "美剧天堂收集最新热播美剧、欧美剧集在线观看，提供魔幻科幻、灵异惊悚、都市情感、犯罪历史等分类。",
    });
}

function absUrl(u) {
    if (!u) return "";
    u = strUtil.trim(u);
    if (u.indexOf("http://") === 0 || u.indexOf("https://") === 0) return u;
    if (u.indexOf("//") === 0) return "https:" + u;
    if (u.charAt(0) !== "/") u = "/" + u;
    return SITE_HOST + u;
}

/**
 * @desc 获取站点标签信息（分类页第一页不带页码后缀，形如 /mjtt/1.html）
 */
function getTagInfo() {
    return JSON.stringify([
        { name: "魔幻科幻", url: SITE_HOST + "/mjtt/1" },
        { name: "灵异惊悚", url: SITE_HOST + "/mjtt/2" },
        { name: "都市情感", url: SITE_HOST + "/mjtt/3" },
        { name: "犯罪历史", url: SITE_HOST + "/mjtt/4" },
        { name: "选秀综艺", url: SITE_HOST + "/mjtt/5" },
        { name: "动漫卡通", url: SITE_HOST + "/mjtt/6" }
    ]);
}

/**
 * @desc 分类页请求：第1页 /mjtt/1.html，第2页起 /mjtt/1-2.html
 */
function parseTagRequest(url, page) {
    var p = parseInt(page, 10) || 1;
    var urlRequest = {
        url: p > 1 ? url + "-" + p + ".html" : url + ".html",
        request: {
            method: "get",
            headers: requestHeaders(),
            data: {}
        }
    };
    return JSON.stringify(urlRequest);
}

function requestHeaders() {
    return {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.188"
    };
}

/**
 * @desc 列表页解析：每个条目在 div.cn_box2 中，标题链接为 a.B.font_16
 */
function getMediaTagListByResponse(responseText) {
    var document = htmlParser.parse(responseText);
    var boxes = document.querySelectorAll("div.cn_box2");
    var mediaList = [];
    for (var i = 0; i < boxes.length; i++) {
        var box = boxes.at(i);
        var a = box.querySelector("a.B.font_16");
        if (!a) a = box.querySelector("ul.list_20 a");
        if (!a) continue;
        var href = a.getAttr("href") || "";
        if (href.indexOf("/meijutt/") < 0) continue;

        var name = strUtil.trim(a.getAttr("title") || a.innerText);
        if (!name) continue;

        var imgEl = box.querySelector("img");
        var pic = imgEl ? (imgEl.getAttr("data-original") || imgEl.getAttr("src") || "") : "";

        var noteEl = box.querySelector("ul.list_20 span");
        var note = noteEl ? strUtil.trim(noteEl.innerText) : "";
        if (!note) {
            var emEl = box.querySelector("div.bor_img3_right em");
            if (emEl) note = strUtil.trim(emEl.innerText);
        }

        mediaList.push({
            vod_name: name,
            vod_id: absUrl(href),
            vod_pic: absUrl(pic),
            vod_play_note: note,
            vod_time: ""
        });
    }

    var pagecount = 1;
    var pageBox = document.querySelector("div.page");
    if (pageBox) {
        var links = pageBox.querySelectorAll("a");
        for (var j = 0; j < links.length; j++) {
            var text = strUtil.trim(links.at(j).innerText).replace(/\./g, "");
            var n = 0;
            var mh = /-(\d+)\.html/.exec(links.at(j).getAttr("href") || "");
            if (mh) n = parseInt(mh[1], 10);
            else if (/^\d+$/.test(text)) n = parseInt(text, 10);
            if (n > pagecount) pagecount = n;
        }
    }

    return JSON.stringify({
        pagecount: pagecount,
        list: mediaList
    });
}

/**
 * @desc 详情页请求
 */
function parseMediaPlaylistRequest(url) {
    return JSON.stringify({
        url: url,
        request: {
            method: "get",
            headers: requestHeaders(),
            data: {}
        }
    });
}

/**
 * @desc 详情页分集解析
 * 线上线路集中在 div.tabs.from-tabs 的 label 列表（如“无尽视频[8]”），
 * 对应下方 div.tabs-list（id=play_N）内的 ul.mn_list_li_movie 真实分集链接。
 * 网盘线路（夸克/迅雷/百度）与 1080P/720P 下载区不在 tabs-list 内，直接忽略。
 */
function getMediaPlaylistByResponse(responseText) {
    var html = htmlParser.parse(responseText);
    var serverNames = [];
    var tabGroups = html.querySelectorAll("div.tabs.from-tabs");
    if (tabGroups.length > 0) {
        var labels = tabGroups.at(0).querySelectorAll("label");
        for (var i = 0; i < labels.length; i++) {
            serverNames.push(strUtil.trim(labels.at(i).innerText).replace(/\[\s*\d+\s*\]\s*$/, ""));
        }
    }

    var playlist = [];
    var lists = html.querySelectorAll("div.tabs-list");
    for (var L = 0; L < lists.length; L++) {
        var box = lists.at(L);
        var ul = box.querySelector("ul.mn_list_li_movie");
        if (!ul) continue;

        var idx = L;
        var idMatch = /^play_(\d+)$/.exec(box.getAttr("id") || "");
        if (idMatch) idx = parseInt(idMatch[1], 10) - 1;

        var serverName = serverNames[idx] || serverNames[L] || ("线路" + (L + 1));
        if (!serverName) continue;

        var eplist = [];
        var eps = ul.querySelectorAll("a");
        for (var e = 0; e < eps.length; e++) {
            var ep = eps.at(e);
            var href = ep.getAttr("href") || "";
            if (href.indexOf("/meijuplay/") < 0) continue;
            eplist.push({
                vod_name: strUtil.trim(ep.innerText || ep.getAttr("title") || ("第" + (e + 1) + "集")),
                vod_play_url: absUrl(href),
                need_parse: true
            });
        }
        if (eplist.length === 0) continue;

        playlist.push({
            server: serverName,
            list: eplist
        });
    }

    return JSON.stringify(playlist);
}

/**
 * @desc 播放页请求
 */
function parseMediaPlayUrlRequest(url, step) {
    return JSON.stringify({
        url: url,
        request: {
            method: "get",
            headers: requestHeaders(),
            data: {}
        }
    });
}

/**
 * @desc 播放页解析：var now=unescape("https%3A%2F%2F...index.m3u8")
 */
function getMediaPlayUrlByResponse(responseText, step) {
    var text = responseText || "";
    var playUrl = "";

    var m = /var\s+now\s*=\s*unescape\(\s*"([\s\S]*?)"\s*\)/.exec(text);
    if (m) {
        playUrl = m[1];
    } else {
        var plain = /var\s+now\s*=\s*"([\s\S]*?)"/.exec(text);
        if (plain) playUrl = plain[1];
    }

    if (!playUrl) {
        playUrl = htmlParser.parse(text).getScriptValue("now") || "";
    }

    playUrl = strUtil.trim(playUrl);
    if (playUrl.indexOf("%") >= 0) {
        try { playUrl = unescape(playUrl); } catch (e) { }
    }
    if (playUrl.indexOf("//") === 0) playUrl = "https:" + playUrl;

    return JSON.stringify({
        vod_play_url: playUrl,
        need_parse: false
    });
}
