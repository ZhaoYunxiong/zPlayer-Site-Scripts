/**
 * @desc 获取站点信息
 * @return {String} json字符串
 */
function getSiteInfo() {
    //该示例站点可以调试或直接保存，并在视频库中刷新查看加载效果
    return JSON.stringify({
        id: "qukanba",
        name: "去看吧", //视频站点名称
        group: "影视", //站点分组
        version: 1, //版本信息，如果上传到插件市场，可通过该值进行更新插件
        desc: "海外更新最快的動漫網，是壹個在海外動漫資源最全，日漫更新速度第壹，播放資源高清完整版的壹個大型動漫社區，同时为您提供无修动漫在线免费观看，和bl动漫在线免费动漫观看，bl动漫大全和bl漫画免费等等和bl动漫相关的作品", //站点介绍信息
        host: "https://k6dm.com",
        showHost: true
    });
}

/**
 * @desc 获取站点标签信息
 * @return {String} json字符串
 */
function getTagInfo() {
    return JSON.stringify([
        {
            name: "高清原碟",
            url: "https://k6dm.com/index.php/vod/type/id/33/page/"
        },
        {
            name: "日漫",
            url: "https://k6dm.com/index.php/vod/type/id/21/page/"
        },
        {
            name: "女频",
            url: "https://k6dm.com/index.php/vod/type/id/50/page/"
        },
        {
            name: "剧场",
            url: "https://k6dm.com/index.php/vod/type/id/24/page/"
        },
        {
            name: "美漫",
            url: "https://k6dm.com/index.php/vod/type/id/22/page/"
        }
    ]);
}

/**
 * @desc 获取站点分类地址的请求方式
 * @param {String} url 请求地址
 * @param {Number} page 页码
 * @return {String} json字符串
 */
function parseTagRequest(url, page) {
    let urlRequest = {
        url: url + page + ".html", //根据页码拼接请求url
        request: {
            method: "get",
            headers: {
                "Accept": "*/*",
                "Accept-Encoding": "gzip, deflate, br",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.188"
            },
            data: {}
        }
    };
    return JSON.stringify(urlRequest);
}

/**
 * @desc 根据站点分类地址请求所得到的html进行解析，返回媒体列表
 * @param {String} responseText parseTagRequest方法请求返回的结果
 * @return {String} json字符串
 */
function getMediaTagListByResponse(responseText) {
    let html = htmlParser.parse(responseText);
    let liList = html.querySelectorAll("li.fed-list-item.fed-padding.fed-col-xs4.fed-col-sm3.fed-col-md2");
    let mediaList = [];
    let len = liList.length;
    for (let i = 0; i < len; i++) {
        let li = liList.at(i);
        let a = li.querySelector("a.fed-list-title.fed-font-xiv.fed-text-center.fed-text-sm-left.fed-visible.fed-part-eone");
        mediaList.push({
            vod_name: a.innerText, //视频名称
            vod_id: "https://k6dm.com" + a.href, //一般为视频url或id
            vod_pic: li.querySelector("a").attr("data-original"), //视频缩略图地址
            vod_play_note: li.querySelector("span.fed-list-remarks.fed-font-xii.fed-text-white.fed-text-center").innerText, //在左下角显示的集数信息
            vod_time: "" //在右下角显示的更新日期
        })
    }

    return JSON.stringify({
        pagecount: strUtil.getMaxNumber(html.querySelector("div.fed-page-info.fed-text-center").querySelectorAll("a").toArrayString(), "[0-9]{1,}[.]html"),
        list: mediaList
    });
}

/**
 * @desc 获取媒体播放列表请求方式
 * @param {String} url vod_id表示视频id或视频url
 * @return {String} json字符串
 */
function parseMediaPlaylistRequest(url) {
    let urlRequest = {
        url: url,
        request: {
            method: "get",
            headers: {
                "Accept": "*/*",
                "Accept-Encoding": "gzip, deflate, br",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.188"
            },
            data: {}
        }
    };
    return JSON.stringify(urlRequest);
}

/**
 * @desc 根据播放列表请求所得到的html进行解析，返回播放列表集数信息
 * @param {String} responseText parseMediaPlaylistRequest方法请求返回的结果
 * @return {String} json字符串
 */
function getMediaPlaylistByResponse(responseText) {
    let html = htmlParser.parse(responseText);
    let aList = html.querySelectorAll("a.fed-btns-info.fed-rims-info.fed-part-eone");
    let playlist = [];
    playlist.push({
        server: "线路1",
        list: []
    });
    let len = aList.length;
    console.log(len)
    for (let i = 0; i < len; i++) {
        let a = aList.at(i);
        let text = a.innerText;
        if (text.indexOf("世界") > -1 || text.indexOf("看吧") > -1) {
            continue;
        }
        playlist[0].list.push({
            vod_name: text,
            vod_play_url: "https://k6dm.com" + a.href,
            need_parse: true
        });
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
    let urlRequest = {
        url: url,
        request: {
            method: "webviewres",
            data: {
                urlRegex : "jsonapi.php",
                readMode : "url"
            }
        }
    };
    return JSON.stringify(urlRequest);
}

/**
 * @desc 根据播放列表请求的html解析，返回真实的播放地址，若需要多个步骤请求解析，则通过step变量判断步骤，从1开始计数
 * @param {String} url responseText parseMediaPlayUrlRequest方法请求返回的结果
 * @param {Number} step 请求次数
 * @return {String} json字符串
 */
function getMediaPlayUrlByResponse(responseText, step) {
    let playItem = {
        vod_play_url: responseText, //解析得到的播放地址
        need_parse: false //是否仍需要解析，如果不需要则直接播放该地址，如果需要解析，则会调用parseMediaPlayUrlRequest再调用getMediaPlayUrlByResponse方法
    };
    return JSON.stringify(playItem);
}

/**
 * @desc 获取媒体搜索的请求方式
 * @param {String} keyword 搜索关键字
 * @param {Number} page 页码
 * @return {String} json字符串
 */
function getMediaSearchRequest(keyword, page) {
    let urlRequest = {
        url: "https://k6dm.com/index.php/vod/search/page/2/wd/" + encodeURIComponent(keyword) + ".html", //搜索接口
        request: {
            method: "get",
            headers: {
                "Accept": "*/*",
                "Accept-Encoding": "gzip, deflate, br",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.188"
            }
        }
    };
    return JSON.stringify(urlRequest);
}

/**
 * @desc 根据媒体搜索请求的html，返回媒体列表
 * @param {String} url responseText getMediaSearchRequest方法请求返回的结果
 * @return {String} json字符串
 */
function getMediaSearchByResponse(responseText) {
    return getMediaTagListByResponse(responseText); //返回格式与该方法一致
}