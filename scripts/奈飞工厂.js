/**
 * 奈飞工厂（NetflixGC）在线库 JS 模板
 * 站点: https://www.netflixgc.com/
 * 结构: MacCMS(dsn2模板)。列表走 POST /index.php/ds_api/vod（JSON）；
 *       详情页分集在 .anthology-list-box（与 .anthology-tab 一一对应）；
 *       播放页 var player_aaaa encrypt=2，地址 = unescape(Base64.decode(url))。
 * 说明: 初版仅暴露已实测可直连的线路 "蓝光-4"（wsym3u8 源，m3u8 主列表 206 可读）；
 *       其它线路待后续按需扩展（在 NETFLIXGC_SUPPORTED_SERVERS 中增加即可）。
 */
var NETFLIXGC_HOST = "https://www.netflixgc.com";
var NETFLIXGC_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var NETFLIXGC_SUPPORTED_SERVERS = { "蓝光-4": true };

function getSiteInfo() {
    return JSON.stringify({
        id: "netflixgc",
        name: "奈飞工厂",
        group: "影视",
        version: 1,
        host: "https://www.netflixgc.com",
        desc: "奈飞工厂 NetflixGC：Netflix 影剧动漫在线播放（当前版本支持蓝光-4线路）"
    });
}

function getTagInfo() {
    return JSON.stringify([
        { name: "电影", url: "{{host}}/vodshow/1-----------.html" },
        { name: "连续剧", url: "{{host}}/vodshow/2-----------.html" },
        { name: "纪录片", url: "{{host}}/vodshow/24-----------.html" },
        { name: "漫剧", url: "{{host}}/vodshow/3-----------.html" },
        { name: "综艺", url: "{{host}}/vodshow/23-----------.html" }
    ]);
}

function parseTagRequest(url, page) {
    var tid = "";
    var m = /vodshow\/(\d+)/.exec(url || "");
    if (m) tid = m[1];
    var p = parseInt(page, 10);
    if (!(p > 0)) p = 1;
    return JSON.stringify({
        url: NETFLIXGC_HOST + "/index.php/ds_api/vod",
        request: {
            method: "post",
            headers: {
                "User-Agent": NETFLIXGC_UA,
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": NETFLIXGC_HOST + "/vodshow/" + tid + "-----------.html"
            },
            data: {
                type: tid,
                "class": "",
                area: "",
                year: "",
                lang: "",
                version: "",
                state: "",
                letter: "",
                time: "",
                level: "0",
                weekday: "",
                by: "time",
                page: p
            }
        }
    });
}

function getMediaTagListByResponse(responseText) {
    var data = JSON.parse(responseText);
    var items = (data && data.list) ? data.list : [];
    var list = [];
    for (var i = 0; i < items.length; i++) {
        var v = items[i];
        var u = v.url || "";
        if (u && u.charAt(0) === "/") u = NETFLIXGC_HOST + u;
        list.push({
            vod_name: v.vod_name || "",
            vod_id: u,
            vod_pic: v.vod_pic || "",
            vod_play_note: v.vod_remarks || ""
        });
    }
    var pc = parseInt(data.pagecount, 10);
    return JSON.stringify({ pagecount: pc > 0 ? pc : 1, list: list });
}

function parseMediaPlaylistRequest(url) {
    return JSON.stringify({
        url: url,
        request: {
            method: "get",
            headers: {
                "User-Agent": NETFLIXGC_UA,
                "Referer": NETFLIXGC_HOST + "/"
            }
        }
    });
}

function netflixgcCleanTabName(innerHtml) {
    var h = String(innerHtml || "");
    h = h.replace(/<span[^>]*>[\s\S]*?<\/span>/g, "");
    h = h.replace(/<[^>]*>/g, "");
    h = h.replace(/&nbsp;/g, " ");
    h = h.replace(/&amp;/g, "&");
    return h.replace(/\s+/g, " ").trim();
}

function getMediaPlaylistByResponse(responseText) {
    var doc = htmlParser.parse(responseText);
    var tabEls = doc.querySelectorAll(".anthology-tab a");
    var names = [];
    for (var i = 0; i < tabEls.length; i++) {
        names.push(netflixgcCleanTabName(tabEls[i].innerHTML));
    }
    var boxes = doc.querySelectorAll(".anthology-list-box");
    var result = [];
    for (var j = 0; j < boxes.length; j++) {
        var serverName = names[j] || ("线路" + (j + 1));
        if (NETFLIXGC_SUPPORTED_SERVERS[serverName] !== true) continue;
        var links = boxes[j].querySelectorAll("a");
        var eps = [];
        for (var k = 0; k < links.length; k++) {
            var href = "";
            try { href = String(links[k].href || ""); } catch (e) { href = ""; }
            if (!/^\/vodplay\/\d+-\d+-\d+\.html/.test(href)) continue;
            var title = "";
            try { title = String(links[k].text || ""); } catch (e2) { title = ""; }
            title = title.replace(/\s+/g, "").trim();
            if (!title) continue;
            eps.push({
                vod_name: title,
                vod_play_url: NETFLIXGC_HOST + href,
                need_parse: true
            });
        }
        if (eps.length > 0) result.push({ server: serverName, list: eps });
    }
    return JSON.stringify(result);
}

function parseMediaPlayUrlRequest(url, step) {
    return JSON.stringify({
        url: url,
        request: {
            method: "get",
            headers: {
                "User-Agent": NETFLIXGC_UA,
                "Referer": NETFLIXGC_HOST + "/"
            }
        }
    });
}

function getMediaPlayUrlByResponse(responseText, step) {
    var m = /var player_aaaa\s*=\s*([\s\S]*?)<\/script>/.exec(responseText);
    if (!m) return JSON.stringify({ vod_play_url: "", need_parse: false });
    var jsonText = m[1].replace(/;\s*$/, "").trim();
    var obj = null;
    try { obj = JSON.parse(jsonText); } catch (e) { obj = null; }
    if (!obj) return JSON.stringify({ vod_play_url: "", need_parse: false });
    var playUrl = obj.url || "";
    var encrypt = parseInt(obj.encrypt, 10);
    if (isNaN(encrypt)) encrypt = 0;
    if (encrypt === 2) {
        playUrl = unescape(Base64.decode(playUrl));
    } else if (playUrl && (encrypt === 1 || playUrl.charAt(0) === "%")) {
        playUrl = unescape(playUrl);
    }
    return JSON.stringify({ vod_play_url: playUrl, need_parse: false });
}
