/**
 * @desc 获取站点信息
 * @return {String} json字符串
 */
function getSiteInfo() {
    return JSON.stringify({
        id: "wedm",
        name: "WE动漫", //视频站点名称
        group: "影视", //站点分组
        version: 2, //版本信息，站点更换域名并重写解析后递增
        desc: "日漫,最新日本动漫,好看的日本动漫,日本动漫排行榜推荐,日本动漫大全", //站点介绍信息
        host: "https://www.wedm3.com", //站点实际域名，换域名只需改这里
        showHost: true
    });
}

var WE_HOST = "https://www.wedm3.com";
var WE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
var _weShareBase = ""; // 分享页所在域名，用于把分享页给出的相对直链拼成绝对地址

function weHeaders() {
    return {
        "User-Agent": WE_UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9"
    };
}

/** 相对地址补全为站点绝对地址 */
function weAbsUrl(u) {
    if (!u) {
        return "";
    }
    if (/^https?:\/\//i.test(u)) {
        return u;
    }
    if (u.charAt(0) === "/") {
        return WE_HOST + u;
    }
    return WE_HOST + "/" + u;
}

function weText(el) {
    if (!el) {
        return "";
    }
    var t = el.text || "";
    return ("" + t).replace(/\s+/g, " ").trim();
}

function weAttr(el, name) {
    if (!el) {
        return "";
    }
    var v = el.attr(name);
    return v === null || v === undefined ? "" : "" + v;
}

/**
 * @desc 获取站点标签信息
 * @return {String} json字符串
 */
function getTagInfo() {
    return JSON.stringify([
        { name: "动漫", url: WE_HOST + "/vod/show/id/23.html" },
        { name: "国产动漫", url: WE_HOST + "/vod/show/id/44.html" },
        { name: "日韩动漫", url: WE_HOST + "/vod/show/id/45.html" },
        { name: "欧美动漫", url: WE_HOST + "/vod/show/id/46.html" },
        { name: "港台动漫", url: WE_HOST + "/vod/show/id/53.html" },
        { name: "海外动漫", url: WE_HOST + "/vod/show/id/54.html" }
    ]);
}

/**
 * @desc 获取站点分类地址的请求方式
 * @param {String} url 请求地址（一级分类页，形如 /vod/show/id/23.html）
 * @param {Number} page 页码
 * @return {String} json字符串
 */
function parseTagRequest(url, page) {
    var p = parseInt(page, 10);
    if (!p || p < 1) {
        p = 1;
    }
    // 站点分页形如 /vod/show/id/23/page/2.html，第1页不带页码
    var reqUrl = p === 1 ? url : url.replace(/\.html$/, "") + "/page/" + p + ".html";
    return JSON.stringify({
        url: reqUrl,
        request: {
            method: "get",
            headers: weHeaders()
        }
    });
}

/**
 * @desc 根据站点分类地址请求所得到的html进行解析，返回媒体列表
 * @param {String} responseText parseTagRequest方法请求返回的结果
 * @return {String} json字符串
 */
function getMediaTagListByResponse(responseText) {
    var html = htmlParser.parse(responseText);
    var box = html.querySelector("div.culum_con");
    var ul = box ? box.querySelector("ul.c2_list") : html.querySelector("ul.c2_list");
    var liList = ul ? ul.querySelectorAll("li") : null;
    var len = liList ? liList.length : 0;
    var mediaList = [];
    for (var i = 0; i < len; i++) {
        var li = liList.at(i);
        var a = li.querySelector("div.show_play a");
        if (!a) {
            a = li.querySelector("a.tcl-img");
        }
        if (!a) {
            continue;
        }
        var href = weAttr(a, "href");
        if (!href || href.indexOf("/vod/detail/") < 0) {
            continue;
        }
        var picDiv = a.querySelector("div.tc_img");
        var noteP = a.querySelector("p.tc_wz");
        var nameA = li.querySelector("div.name a");
        var name = weAttr(a, "title");
        if (!name) {
            name = weText(nameA);
        }
        mediaList.push({
            vod_name: name,
            vod_id: weAbsUrl(href),
            vod_pic: weAttr(picDiv, "data-original"),
            vod_play_note: weText(noteP),
            vod_time: ""
        });
    }

    // 分页：div.pages 内 /page/N.html 的最大页码
    var pagecount = 1;
    var pager = html.querySelector("div.pages");
    if (pager) {
        var pas = pager.querySelectorAll("a");
        for (var j = 0; j < pas.length; j++) {
            var mm = /\/page\/(\d+)\.html/.exec(weAttr(pas.at(j), "href"));
            if (mm) {
                var n = parseInt(mm[1], 10);
                if (n > pagecount) {
                    pagecount = n;
                }
            }
        }
    }

    return JSON.stringify({
        pagecount: pagecount,
        list: mediaList
    });
}

/**
 * @desc 获取媒体播放列表请求方式
 * @param {String} url vod_id表示视频id或视频url
 * @return {String} json字符串
 */
function parseMediaPlaylistRequest(url) {
    return JSON.stringify({
        url: weAbsUrl(url),
        request: {
            method: "get",
            headers: weHeaders()
        }
    });
}

/**
 * @desc 根据播放列表请求所得到的html进行解析，返回播放列表集数信息
 * @param {String} responseText parseMediaPlaylistRequest方法请求返回的结果
 * @return {String} json字符串
 */
function getMediaPlaylistByResponse(responseText) {
    var html = htmlParser.parse(responseText);
    // 详情页内每个播放线路是一个 div.tab-content（id 形如 tab_con_playlist_1），
    // 线路名在同级 li.tab-switch 的 a 文本中，通过 switch 属性对应 tab 的 id
    var tabNames = {};
    var switches = html.querySelectorAll("ul.con_c2_title li.tab-switch");
    var swLen = switches ? switches.length : 0;
    for (var i = 0; i < swLen; i++) {
        var li = switches.at(i);
        var sw = weAttr(li, "switch");
        var nameA = li.querySelector("a");
        if (sw) {
            tabNames[sw] = weText(nameA);
        }
    }

    var tabs = html.querySelectorAll("div.tab-content");
    var tabLen = tabs ? tabs.length : 0;
    var playlist = [];
    var feifanRoute = null; // 非直链分享线路（sid=2），排在最后，优先使用可直出的线路
    for (var t = 0; t < tabLen; t++) {
        var tab = tabs.at(t);
        var tabId = weAttr(tab, "id");
        var alist = tab.querySelectorAll("ul.con_c2_list a");
        var aLen = alist ? alist.length : 0;
        if (aLen === 0) {
            continue;
        }
        var eps = [];
        var isShareRoute = false;
        for (var j = 0; j < aLen; j++) {
            var a = alist.at(j);
            var href = weAttr(a, "href");
            if (!href || href.indexOf("/vod/play/") < 0) {
                continue;
            }
            if (href.indexOf("/sid/2/") >= 0) {
                isShareRoute = true;
            }
            var nm = weAttr(a, "title");
            if (!nm) {
                nm = weText(a);
            }
            eps.push({
                vod_name: nm,
                vod_play_url: weAbsUrl(href),
                need_parse: true
            });
        }
        if (eps.length === 0) {
            continue;
        }
        var routeName = tabNames[tabId] || ("线路" + (t + 1));
        var route = {
            server: routeName,
            list: eps
        };
        if (isShareRoute) {
            feifanRoute = route;
        } else {
            playlist.push(route);
        }
    }
    if (feifanRoute) {
        playlist.push(feifanRoute);
    }
    return JSON.stringify(playlist);
}

/**
 * @desc 获取播放列表中每一集的请求方式
 * @param {String} url vod_play_url播放地址
 * @param {Number} step 请求次数
 * @return {String} json字符串
 */
function parseMediaPlayUrlRequest(url, step) {
    var s = parseInt(step, 10);
    if (!s || s < 1) {
        s = 1;
    }
    // 第1步取播放页（内含 player_aaaa 播放数据）
    // 第2步仅在播放页给出的是外站分享页时才发生，此时抓分享页找媒体直链
    return JSON.stringify({
        url: weAbsUrl(url),
        preserveHost: s > 1,
        request: {
            method: "get",
            headers: weHeaders()
        }
    });
}

/**
 * @desc 根据播放列表请求的html解析，返回真实的播放地址，若需要多个步骤请求解析，则通过step变量判断步骤，从1开始计数
 * @param {String} responseText parseMediaPlayUrlRequest方法请求返回的结果
 * @param {Number} step 请求次数
 * @return {String} json字符串
 */
function getMediaPlayUrlByResponse(responseText, step) {
    var s = parseInt(step, 10);
    if (!s || s < 1) {
        s = 1;
    }
    var text = responseText || "";

    // 已经是媒体直链
    if (/^\s*https?:\/\/[^\s]+?\.(m3u8|mp4|flv)(\?|#|$)/i.test(text)) {
        return JSON.stringify({
            vod_play_url: text.trim(),
            need_parse: false
        });
    }

    if (s === 1) {
        // 播放页 player_aaaa：MacCMS 结构，encrypt 标识是否编码
        var m = /player_aaaa\s*=\s*(\{[\s\S]*?\})\s*<\/script>/.exec(text);
        if (!m) {
            m = /player_aaaa\s*=\s*(\{[\s\S]*?\})\s*;?\s*$/.exec(text);
        }
        if (!m) {
            return JSON.stringify({ vod_play_url: "", need_parse: false });
        }
        var jsonText = m[1];
        var encrypt = 0;
        var em = /"encrypt"\s*:\s*([0-9]+)/.exec(jsonText);
        if (em) {
            encrypt = parseInt(em[1], 10);
        }
        var um = /"url"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(jsonText);
        var playUrl = um ? um[1] : "";
        // JSON 中的转义还原
        playUrl = playUrl.replace(/\\\//g, "/").replace(/\\u0026/g, "&");
        if (playUrl && encrypt === 2) {
            playUrl = unescape(Base64.decode(playUrl));
        } else if (playUrl && (encrypt === 1 || playUrl.charAt(0) === "%")) {
            playUrl = unescape(playUrl);
        }
        if (!playUrl) {
            return JSON.stringify({ vod_play_url: "", need_parse: false });
        }
        if (/^https?:\/\/[^\s]+?\.(m3u8|mp4|flv)(\?|#|$)/i.test(playUrl)) {
            return JSON.stringify({
                vod_play_url: playUrl,
                need_parse: false
            });
        }
        // 外站分享页，继续请求该页取媒体地址
        // 记录分享页基址：分享页里的直链常写成相对路径 + sign 签名
        var bm = /^(https?:\/\/[^\/]+)/i.exec(playUrl);
        _weShareBase = bm ? bm[1] : "";
        return JSON.stringify({
            vod_play_url: playUrl,
            need_parse: true
        });
    }

    // 第2步：从分享页里提取媒体直链
    // 情况一：绝对地址
    var mm = /(https?:\/\/[^"'\s<>\\]+?\.(?:m3u8|mp4|flv)[^"'\s<>\\]*)/i.exec(text);
    if (mm) {
        return JSON.stringify({
            vod_play_url: mm[1].replace(/\\\//g, "/"),
            need_parse: false
        });
    }
    // 情况二：相对地址（如 const url = "/20261007/xxx/index.m3u8?sign=..."）
    var rm = /["'](\/[^"'\s<>\\]*?\.(?:m3u8|mp4|flv)[^"'\s<>\\]*)["']/i.exec(text);
    if (rm) {
        var rel = rm[1].replace(/\\\//g, "/");
        return JSON.stringify({
            vod_play_url: (_weShareBase || WE_HOST) + rel,
            need_parse: false
        });
    }
    return JSON.stringify({ vod_play_url: "", need_parse: false });
}

/**
 * @desc 获取媒体搜索的请求方式
 * @param {String} keyword 搜索关键字
 * @param {Number} page 页码
 * @return {String} json字符串
 */
function getMediaSearchRequest(keyword, page) {
    var p = parseInt(page, 10);
    if (!p || p < 1) {
        p = 1;
    }
    var url = WE_HOST + "/vod/search.html?wd=" + encodeURIComponent(keyword);
    if (p > 1) {
        url += "&page=" + p;
    }
    return JSON.stringify({
        url: url,
        request: {
            method: "get",
            headers: weHeaders()
        }
    });
}

/**
 * @desc 根据媒体搜索请求的html，返回媒体列表
 * @param {String} responseText getMediaSearchRequest方法请求返回的结果
 * @return {String} json字符串
 */
function getMediaSearchByResponse(responseText) {
    var html = htmlParser.parse(responseText);
    var box = html.querySelector("div.sear_con");
    var listBox = box ? box.querySelectorAll("div.result_list") : html.querySelectorAll("div.result_list");
    var len = listBox ? listBox.length : 0;
    var mediaList = [];
    for (var i = 0; i < len; i++) {
        var li = listBox.at(i);
        var a = li.querySelector("a");
        if (!a) {
            continue;
        }
        var href = weAttr(a, "href");
        if (!href || href.indexOf("/vod/detail/") < 0) {
            continue;
        }
        var titleBox = li.querySelector("div.result_title");
        var name = weText(titleBox ? titleBox.querySelector("a") : a);
        if (!name) {
            name = weAttr(a, "title");
        }
        var picDiv = a.querySelector("div.tc_img");
        if (!picDiv) {
            picDiv = a.querySelector("div");
        }
        mediaList.push({
            vod_name: name,
            vod_id: weAbsUrl(href),
            vod_pic: weAttr(picDiv, "data-original"),
            vod_play_note: "",
            vod_time: ""
        });
    }

    var pagecount = 1;
    var pager = html.querySelector("div.pages");
    if (pager) {
        var pas = pager.querySelectorAll("a");
        for (var j = 0; j < pas.length; j++) {
            var mm = /page[=\/](\d+)/.exec(weAttr(pas.at(j), "href"));
            if (mm) {
                var n = parseInt(mm[1], 10);
                if (n > pagecount) {
                    pagecount = n;
                }
            }
        }
    }

    return JSON.stringify({
        pagecount: pagecount,
        list: mediaList
    });
}
