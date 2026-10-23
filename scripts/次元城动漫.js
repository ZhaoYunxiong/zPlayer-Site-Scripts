var CYC_BASE = "https://www.cycani.org";
var CYC_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.5615.204 Safari/537.36";
function getSiteInfo() {
    return JSON.stringify({
        id: "cycani",
        name: "次元城动漫",
        group: "影视",
        version: 4,
        desc: "次元城动漫",
        host: "https://www.cycani.org",
        parameters: [{"key":"auth","label":"auth（Authorization）","type":"password","required":true,"placeholder":"Token 或 Bearer Token","description":"粘贴登录后请求头 Authorization 的值，也可只填 Token；失效后在此更新。"}],
    });
}

function cycHeaders(withAuth) {
    var h = {
        "Accept": "application/json",
        "X-App-Name": "cyc_web",
        "X-App-Version": "cycweb",
        "X-Time-Zone": "Asia/Shanghai",
        "User-Agent": CYC_UA
    };
    if (withAuth) {
        // 配置同时兼容完整 Bearer 请求头和只包含 JWT 的输入。
        var auth = String(siteConfig.auth || "").trim();
        if (auth) h["Authorization"] = /^Bearer\s+/i.test(auth) ? auth : "Bearer " + auth;
    }
    return h;
}

function tagUrl(tag) {
    if (!tag) {
        return CYC_BASE + "/api/videos?zone_id=1";
    }
    return CYC_BASE + "/api/videos?zone_id=1&tag=" + encodeURIComponent(tag);
}

function getTagInfo() {
    var tags = [
        "原创", "漫画改", "小说改", "游戏改", "异世界", "特摄",
        "热血", "穿越", "奇幻", "战斗", "搞笑", "日常",
        "科幻", "治愈", "校园", "泡面", "恋爱", "少女",
        "魔法", "冒险", "运动", "音乐", "推理", "美食",
        "偶像", "职场", "后宫", "百合", "历史", "架空",
        "机战", "励志", "社团", "智斗", "催泪", "乙女"
    ];
    var list = [
        { name: "TV番组", url: tagUrl("") },
        { name: "剧场番组", url: CYC_BASE + "/api/videos?zone_id=2" }
    ];
    for (var i = 0; i < tags.length; i++) {
        list.push({ name: tags[i], url: tagUrl(tags[i]) });
    }
    return JSON.stringify(list);
}

function parseTagRequest(url, page) {
    return JSON.stringify({
        url: url,
        request: {
            method: "get",
            headers: cycHeaders(false),
            data: {
                "page": page.toString(),
                "page_size": "20",
                "order_by": "update_time"
            }
        }
    });
}

function cycList(p) {
    return {
        vod_name: p.title,
        vod_id: p.video_id,
        vod_pic: p.cover_url,
        vod_play_note: p.remarks
    };
}

function getMediaTagListByResponse(responseText) {
    var jobj = JSON.parse(responseText);
    if (jobj.code !== 0 || !jobj.data || !jobj.data.list) {
        throw new Error("分类列表返回异常：" + (jobj.msg || jobj.code));
    }
    var total = (jobj.data.pager && jobj.data.pager.total) || 0;
    var mediaList = [];
    for (var i = 0; i < jobj.data.list.length; i++) {
        mediaList.push(cycList(jobj.data.list[i]));
    }
    return JSON.stringify({
        pagecount: Math.ceil(total / 20),
        list: mediaList
    });
}

function parseMediaPlaylistRequest(url) {
    // 站点当前仅一条播放线路 cychub（标题 CYC_Main），分集接口需登录会话
    return JSON.stringify({
        url: CYC_BASE + "/api/videos/" + url.toString() + "/sections",
        request: {
            method: "get",
            headers: cycHeaders(true),
            data: {
                "player_code": "cychub",
                "page": "1",
                "page_size": "100"
            }
        }
    });
}

function getMediaPlaylistByResponse(responseText) {
    var jobj = JSON.parse(responseText);
    if (jobj.code !== 0 || !jobj.data || !jobj.data.list) {
        throw new Error("分集列表返回异常：" + (jobj.msg || jobj.code));
    }
    var items = jobj.data.list;
    if (items.length === 0) {
        throw new Error("该条目暂无可播放分集");
    }
    var list = [];
    for (var i = 0; i < items.length; i++) {
        var s = items[i];
        list.push({
            vod_name: s.title,
            vod_play_url: CYC_BASE + "/api/v2/sections/" + s.id + "/play-url",
            need_parse: true
        });
    }
    return JSON.stringify([
        {
            server: "CYC_Main",
            list: list
        }
    ]);
}

function parseMediaPlayUrlRequest(url, step) {
    return JSON.stringify({
        url: url,
        request: {
            method: "get",
            headers: cycHeaders(true),
            data: {}
        }
    });
}

function getMediaPlayUrlByResponse(responseText, step) {
    var jobj = JSON.parse(responseText);
    if (jobj.code !== 0 || !jobj.data || !jobj.data.url) {
        throw new Error("播放地址解析失败：" + (jobj.msg || "未登录或该集无地址"));
    }
    return JSON.stringify({
        vod_play_url: jobj.data.url.toString(),
        need_parse: false
    });
}

function getMediaSearchRequest(keyword, page) {
    return JSON.stringify({
        url: CYC_BASE + "/api/videos/search",
        request: {
            method: "get",
            headers: cycHeaders(false),
            data: {
                "q": encodeURIComponent(keyword),
                "zone_id": "1",
                "page": page.toString(),
                "page_size": "30"
            }
        }
    });
}

function getMediaSearchByResponse(responseText) {
    var jobj = JSON.parse(responseText);
    if (jobj.code !== 0 || !jobj.data || !jobj.data.list) {
        throw new Error("搜索返回异常：" + (jobj.msg || jobj.code));
    }
    var total = (jobj.data.pager && jobj.data.pager.total) || 0;
    var mediaList = [];
    for (var i = 0; i < jobj.data.list.length; i++) {
        mediaList.push(cycList(jobj.data.list[i]));
    }
    return JSON.stringify({
        pagecount: Math.ceil(total / 30),
        list: mediaList
    });
}
