function getSiteInfo() {
    return JSON.stringify({
        id: "xgcartoon",
        name: "西瓜卡通",
        group: "影视",
        version: 1,
        desc: "西瓜卡通 - 分类、搜索与播放解析",
        host: "https://cn.xgcartoon.com",
        showHost: true
    });
}

var _tagPage = 1;
var _playVid = "";

function getTagInfo() {
    return JSON.stringify([
        { name: "全部", url: "{{host}}/classify?type=*&region=*&state=*&filter=*" },
        { name: "国漫", url: "{{host}}/classify?type=*&region=cn&state=*&filter=*" },
        { name: "日本", url: "{{host}}/classify?type=*&region=jp&state=*&filter=*" },
        { name: "韩国", url: "{{host}}/classify?type=*&region=kr&state=*&filter=*" },
        { name: "欧美", url: "{{host}}/classify?type=*&region=en&state=*&filter=*" },
        { name: "连载中", url: "{{host}}/classify?type=*&region=*&state=serial&filter=*" },
        { name: "已完结", url: "{{host}}/classify?type=*&region=*&state=published&filter=*" }
    ]);
}

function parseTagRequest(url, page) {
    _tagPage = parseInt(page, 10) || 1;
    var type = "*";
    var region = "*";
    var state = "*";
    var filter = "*";
    var m;
    m = /[?&]type=([^&#]*)/.exec(url);
    if (m) type = m[1].replace(/%2A/gi, "*");
    m = /[?&]region=([^&#]*)/.exec(url);
    if (m) region = m[1].replace(/%2A/gi, "*");
    m = /[?&]state=([^&#]*)/.exec(url);
    if (m) state = m[1].replace(/%2A/gi, "*");
    m = /[?&]filter=([^&#]*)/.exec(url);
    if (m) filter = m[1].replace(/%2A/gi, "*");
    return JSON.stringify({
        url: "https://cn.xgcartoon.com/api/amp_query_cartoon_list?type=" + type + "&region=" + region + "&state=" + state + "&filter=" + filter + "&page=" + _tagPage + "&limit=36&language=cn",
        request: { method: "get" }
    });
}

function getMediaTagListByResponse(responseText) {
    var data = JSON.parse(responseText);
    var items = (data && data.items) || [];
    var list = [];
    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        list.push({
            vod_name: it.name || "",
            vod_id: "https://cn.xgcartoon.com/detail/" + it.cartoon_id,
            vod_pic: "https://static-a.xgcartoon.com/cover/" + it.topic_img + "?w=300&h=256&q=100"
        });
    }
    var pagecount = _tagPage;
    if (data && data.next) {
        var m = /[?&]page=(\d+)/.exec(data.next);
        if (m) {
            var np = parseInt(m[1], 10);
            if (np > pagecount) pagecount = np;
        } else {
            pagecount = _tagPage + 1;
        }
    }
    return JSON.stringify({ pagecount: pagecount, list: list });
}

function getMediaSearchRequest(keyword, page) {
    return JSON.stringify({
        url: "https://cn.xgcartoon.com/search?q=" + encodeURIComponent(keyword) + "&page=" + (parseInt(page, 10) || 1),
        request: { method: "get" }
    });
}

function getMediaSearchByResponse(responseText) {
    var doc = htmlParser.parse(responseText);
    var items = doc.querySelectorAll("a.topic-list-item");
    var list = [];
    for (var i = 0; i < items.length; i++) {
        var a = items.at(i);
        var href = a.getAttr("href") || "";
        if (href.indexOf("/detail/") < 0) continue;
        var nameEl = a.querySelector(".h3");
        var imgEl = a.querySelector("amp-img");
        var name = nameEl ? String(nameEl.text) : "";
        name = name.replace(/^\s+|\s+$/g, "");
        list.push({
            vod_name: name,
            vod_id: href.indexOf("http") === 0 ? href : "https://cn.xgcartoon.com" + href,
            vod_pic: imgEl ? (imgEl.getAttr("src") || "") : ""
        });
    }
    return JSON.stringify({ pagecount: 1, list: list });
}

function getMediaPlaylistByResponse(responseText) {
    var doc = htmlParser.parse(responseText);
    var items = doc.querySelectorAll("a.goto-chapter");
    var list = [];
    for (var i = 0; i < items.length; i++) {
        var a = items.at(i);
        var href = a.getAttr("href") || "";
        if (href.indexOf("/user/page_direct?") < 0 || href.indexOf("chapter_id=") < 0) continue;
        var name = a.getAttr("title") || a.text || "";
        name = String(name).replace(/^\s+|\s+$/g, "");
        list.push({
            vod_name: name,
            vod_play_url: href.indexOf("http") === 0 ? href : "https://cn.xgcartoon.com" + href,
            need_parse: true
        });
    }
    return JSON.stringify([{ server: "西瓜线路", list: list }]);
}

function parseMediaPlayUrlRequest(url, step) {
    if (url.indexOf("video_info.json") >= 0) {
        return JSON.stringify({
            url: url,
            preserveHost: true,
            request: { method: "get" }
        });
    }
    var m = /[?&]chapter_id=([^&]+)/.exec(url);
    var chapterId = m ? m[1] : "";
    return JSON.stringify({
        url: "https://cn.xgcartoon.com/user/amp/content_pframe_url?chapter_id=" + chapterId + "&level=middle&expires=3600",
        request: { method: "get" }
    });
}

function getMediaPlayUrlByResponse(responseText, step) {
    var text = String(responseText || "");
    if (text.indexOf("\"data\"") >= 0 && text.indexOf("player.htm") >= 0) {
        var data = JSON.parse(text);
        var pframe = (data && data.data) ? String(data.data) : "";
        var m = /[?&]vid=([^&]+)/.exec(pframe);
        _playVid = m ? m[1] : "";
        return JSON.stringify({
            vod_play_url: "https://xgct-video.bzcdn.net/" + _playVid + "/video_info.json",
            need_parse: true
        });
    }
    var info = JSON.parse(text);
    var guid = (info && info.guid) ? String(info.guid) : _playVid;
    return JSON.stringify({
        vod_play_url: "https://xgct-video.bzcdn.net/" + guid + "/playlist.m3u8",
        need_parse: false
    });
}
