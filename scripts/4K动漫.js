function getSiteInfo() {
    return JSON.stringify({
        id: "4k-anime",
        name: "4K动漫",
        group: "影视",
        version: 1,
        host: "https://cn.agekkkk.com",
        desc: "4K动漫在线观看"
    });
}

function fixUrl(href) {
    if (!href) { return ""; }
    if (href.indexOf("http") === 0) { return href; }
    if (href.charAt(0) === "/") { return "https://cn.agekkkk.com" + href; }
    return "https://cn.agekkkk.com/" + href;
}

function getTagInfo() {
    return JSON.stringify([
        { name: "日漫", url: "{{host}}/type/1-{{page}}.html" },
        { name: "国漫", url: "{{host}}/type/2-{{page}}.html" },
        { name: "动画", url: "{{host}}/type/5-{{page}}.html" },
        { name: "剧场", url: "{{host}}/type/24-{{page}}.html" },
        { name: "特摄", url: "{{host}}/type/4-{{page}}.html" },
        { name: "美漫", url: "{{host}}/type/3-{{page}}.html" }
    ]);
}

function parseTagRequest(url, page) {
    var p = page || 1;
    var u = url.replace("{{host}}", "https://cn.agekkkk.com").replace("{{page}}", p);
    return JSON.stringify({ url: u });
}

function getMediaTagListByResponse(responseText) {
    var doc = htmlParser.parse(responseText);
    var list = [];
    var cards = doc.querySelectorAll("div.dFdC_cCCbbBF__aCE");
    for (var i = 0; i < cards.length; i++) {
        var el = cards.at(i);
        var link = el.querySelector("h4.title a");
        if (!link) { continue; }
        var href = link.getAttr("href") || "";
        if (!/\/anime\//.test(href)) { continue; }
        var name = strUtil.trim(link.text || link.getAttr("title") || "");
        var pic = "";
        var imgEl = el.querySelector("a.dFdC_cCCbbBF__bCBBJ");
        if (imgEl) {
            pic = imgEl.getAttr("data-original") || imgEl.getAttr("src") || "";
        }
        var note = "";
        var noteEl = el.querySelector("span.cBh_bbFB b");
        if (noteEl) { note = strUtil.trim(noteEl.text || ""); }
        list.push({
            vod_name: name,
            vod_id: fixUrl(href),
            vod_pic: pic,
            vod_play_note: note
        });
    }
    var pagecount = 1;
    var numEl = doc.querySelector("li.num a");
    if (numEl) {
        var mm = /\/([0-9]+)/.exec(numEl.text || "");
        if (mm) { pagecount = parseInt(mm[1], 10); }
    }
    return JSON.stringify({ pagecount: pagecount, list: list });
}

function getMediaPlaylistByResponse(responseText) {
    var doc = htmlParser.parse(responseText);
    var result = [];
    var tabs = doc.querySelectorAll("ul.channel-tab li a");
    for (var i = 0; i < tabs.length; i++) {
        var tab = tabs.at(i);
        var m = /#playlist([0-9]+)/.exec(tab.getAttr("href") || "");
        if (!m) { continue; }
        var serverName = strUtil.trim(tab.text || "").replace(/[0-9]+$/, "");
        if (serverName !== "天堂") { continue; }
        var pane = doc.querySelector("#playlist" + m[1]);
        if (!pane) { continue; }
        var links = pane.querySelectorAll("ul.play-list-content li a");
        var eps = [];
        for (var j = 0; j < links.length; j++) {
            var a = links.at(j);
            var u = a.getAttr("href") || "";
            if (!/\/play\/[0-9]+\/[0-9]+\.html/.test(u)) { continue; }
            eps.push({
                vod_name: strUtil.trim(a.getAttr("title") || a.text || ""),
                vod_play_url: fixUrl(u),
                need_parse: true
            });
        }
        if (eps.length > 0) {
            result.push({ server: serverName, list: eps });
        }
    }
    return JSON.stringify(result);
}

function parseMediaPlayUrlRequest(url, step) {
    return JSON.stringify({ url: url });
}

function getMediaPlayUrlByResponse(responseText, step) {
    var playUrl = "";
    var m = /var\s+player_aaaa\s*=\s*(\{[\s\S]*?\})\s*<\/script>/.exec(responseText);
    if (m) {
        var data = null;
        try {
            data = JSON.parse(m[1]);
        } catch (e) {
            data = null;
        }
        if (data && data.url) {
            playUrl = data.url;
            var encrypt = 0;
            if (data.encrypt !== undefined && data.encrypt !== null) {
                encrypt = parseInt(data.encrypt, 10) || 0;
            }
            if (encrypt === 2) {
                playUrl = unescape(Base64.decode(playUrl));
            } else if (encrypt === 1 || playUrl.charAt(0) === "%") {
                playUrl = unescape(playUrl);
            }
        }
    }
    return JSON.stringify({ vod_play_url: playUrl, need_parse: false });
}
