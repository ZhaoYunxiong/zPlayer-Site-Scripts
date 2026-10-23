function getSiteInfo() {
    return JSON.stringify({
        id: "mifun",
        name: "MiFun动画",
        group: "影视",
        version: 1,
        desc: "MiFun 动画在线观看",
        host: "https://ios.mifun.org",
        showHost: true
    });
}

var BASE = "https://ios.mifun.org";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function getTagInfo() {
    var tags = [
        { name: "番剧", url: BASE + "/vodtype/1/{{page}}/" },
        { name: "国创", url: BASE + "/vodtype/2/{{page}}/" },
        { name: "剧场", url: BASE + "/vodtype/3/{{page}}/" },
        { name: "美漫", url: BASE + "/vodtype/4/{{page}}/" },
        { name: "特摄", url: BASE + "/vodtype/5/{{page}}/" }
    ];
    return JSON.stringify(tags);
}

function absUrl(href) {
    if (!href) return "";
    if (href.indexOf("http") === 0) return href;
    if (href.charAt(0) === "/") return BASE + href;
    return BASE + "/" + href;
}

function getMediaTagListByResponse(responseText) {
    var doc = htmlParser.parse(responseText);
    var nodes = doc.querySelectorAll("li.hl-list-item");
    var list = [];
    for (var i = 0; i < nodes.length; i++) {
        var li = nodes.at(i);
        var link = li.querySelector("div.hl-item-title a");
        if (!link) link = li.querySelector("a.hl-item-thumb");
        if (!link) continue;
        var href = link.getAttr("href") || "";
        if (!/\/voddetail\/\d+\//.test(href)) continue;
        var name = (link.getAttr("title") || link.text || "").replace(/^\s+|\s+$/g, "");
        if (!name) continue;
        var thumb = li.querySelector("a.hl-item-thumb");
        var pic = "";
        if (thumb) pic = thumb.getAttr("data-original") || thumb.getAttr("data-src") || thumb.getAttr("src") || "";
        var noteEl = li.querySelector("div.hl-pic-text span.remarks");
        var note = noteEl ? (noteEl.text || "").replace(/^\s+|\s+$/g, "") : "";
        var stateEl = li.querySelector("div.hl-pic-tag span.state");
        if (!note && stateEl) note = (stateEl.text || "").replace(/^\s+|\s+$/g, "");
        list.push({
            vod_name: name,
            vod_id: absUrl(href),
            vod_pic: pic,
            vod_play_note: note
        });
    }

    var pagecount = 1;
    var tips = doc.querySelectorAll("li.hl-page-tips");
    if (tips.length > 0) {
        var t = (tips.at(0).text || "").replace(/\s/g, "");
        var m = /\/(\d+)$/.exec(t);
        if (m) pagecount = parseInt(m[1], 10);
    }

    return JSON.stringify({ pagecount: pagecount, list: list });
}

function getMediaPlaylistByResponse(responseText) {
    var doc = htmlParser.parse(responseText);
    var tabs = doc.querySelectorAll("div.hl-plays-from a");
    var boxes = doc.querySelectorAll("div.hl-tabs-box");
    var result = [];

    for (var b = 0; b < boxes.length; b++) {
        var serverName = "";
        if (b < tabs.length) serverName = (tabs.at(b).getAttr("alt") || tabs.at(b).text || "").replace(/^\s+|\s+$/g, "");
        if (!serverName) serverName = "线路" + (b + 1);

        var anchors = boxes.at(b).querySelectorAll("a");
        var episodes = [];
        for (var a = 0; a < anchors.length; a++) {
            var el = anchors.at(a);
            var href = el.getAttr("href") || "";
            if (!/^\/vodplay\/\d+-\d+-\d+\/$/.test(href)) continue;
            var epName = (el.text || "").replace(/^\s+|\s+$/g, "");
            if (!epName) continue;
            episodes.push({
                vod_name: epName,
                vod_play_url: absUrl(href),
                need_parse: true
            });
        }
        if (episodes.length > 0) {
            result.push({ server: serverName, list: episodes });
        }
    }

    return JSON.stringify(result);
}

// ===== 播放解析：播放页(player_aaaa) -> data.m3u8.in 播放器页(Sign) -> api.php -> mp4 =====
var mfState = { token: "", playerUrl: "", sign: "", apiUrl: "" };

function parseMediaPlayUrlRequest(url, step) {
    if (/\/vodplay\/\d+-\d+-\d+\//.test(url)) {
        return JSON.stringify({
            url: url,
            request: { method: "get", headers: { "User-Agent": UA } }
        });
    }
    if (url.indexOf("/player/?url=") > -1) {
        return JSON.stringify({
            url: url,
            preserveHost: true,
            request: { method: "get", headers: { "User-Agent": UA } }
        });
    }
    return JSON.stringify({
        url: url,
        preserveHost: true,
        request: { method: "get", headers: { "User-Agent": UA } }
    });
}

function mfDecodePlayUrl(playUrl, jsonText) {
    var encrypt = 0;
    var em = /"encrypt"\s*:\s*(\d+)/.exec(jsonText);
    if (em) encrypt = parseInt(em[1], 10);
    if (!playUrl) return "";
    if (encrypt === 2) {
        try { playUrl = Base64.decode(playUrl); } catch (e) {}
        playUrl = unescape(playUrl);
    } else if (encrypt === 1 || playUrl.charAt(0) === "%") {
        playUrl = unescape(playUrl);
    }
    return playUrl;
}

function getMediaPlayUrlByResponse(responseText, step) {
    // 1) 播放页：取 player_aaaa 中的 url token
    var pm = /var\s+player_aaaa\s*=\s*(\{[\s\S]*?\})\s*<\/script>/.exec(responseText);
    if (pm) {
        var jsonText = pm[1];
        var um = /"url"\s*:\s*"([^"]+)"/.exec(jsonText);
        var token = um ? um[1] : "";
        token = token.replace(/\\\//g, "/");
        token = mfDecodePlayUrl(token, jsonText);
        if (!token) {
            return JSON.stringify({ vod_play_url: "", need_parse: false });
        }
        mfState.token = token;
        mfState.playerUrl = "https://data.m3u8.in/player/?url=" + encodeURIComponent(token);
        mfState.sign = "";
        return JSON.stringify({ vod_play_url: mfState.playerUrl, need_parse: true });
    }

    // 2) 播放器页：取 Sign，拼接解析接口
    var sm = /Sign\s*=\s*["']([^"']+)["']/.exec(responseText);
    if (sm) {
        mfState.sign = sm[1];
        mfState.apiUrl = "https://data.m3u8.in/player/api.php?url=" + encodeURIComponent(mfState.token) +
            "&sign=" + encodeURIComponent(mfState.sign);
        return JSON.stringify({ vod_play_url: mfState.apiUrl, need_parse: true });
    }

    // 3) 解析接口：返回真实媒体地址
    var mediaUrl = "";
    var trimmed = (responseText || "").replace(/^\s+|\s+$/g, "");
    try {
        var data = JSON.parse(trimmed);
        if (data && data.url && (!data.code || parseInt(data.code, 10) === 200)) {
            mediaUrl = data.url;
        }
    } catch (e) {
        var mm = /"url"\s*:\s*"([^"]+)"/.exec(trimmed);
        if (mm) mediaUrl = mm[1];
    }
    mediaUrl = (mediaUrl || "").replace(/\\\//g, "/").replace(/&amp;/g, "&");
    return JSON.stringify({ vod_play_url: mediaUrl, need_parse: false });
}
