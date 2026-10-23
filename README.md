# zPlayer 站点脚本

zPlayer JS 影视站点脚本仓库，用于站点分类、搜索、列表、选集和播放地址解析。播放器事件 Hook 脚本不在本仓库范围内。

订阅地址（首次 Pages 部署成功后生效）：

```text
https://zhaoyunxiong.github.io/zPlayer-Site-Scripts/index.json
```

在 zPlayer 的 **JS 站点设置 → 脚本源** 中添加上面的完整地址即可浏览和安装。新版播放器默认包含此源；如果之前手动清空过订阅列表，可以重新添加。

## 首次开启 GitHub Pages

1. 在仓库 [Settings → Pages](https://github.com/ZhaoYunxiong/zPlayer-Site-Scripts/settings/pages) 中，将 **Build and deployment → Source** 设置为 **GitHub Actions**。
2. 把本地文件提交并推送到 `main`。
3. 在 [Actions](https://github.com/ZhaoYunxiong/zPlayer-Site-Scripts/actions) 查看 **Validate and publish script source**，确认 `build` 和 `deploy` 都成功。
4. 打开 [订阅目录](https://zhaoyunxiong.github.io/zPlayer-Site-Scripts/index.json)，确认返回 JSON；没有迁入脚本时 `scripts` 为 `[]`，属于正常情况。

仓库已提供工作流，无需额外创建 GitHub 推荐的 Pages 模板。发布使用仓库内置的 `GITHUB_TOKEN`，无需配置个人 Token、服务器或 Cloudflare。

## 发布与迁移脚本

每个站点只维护 `scripts/` 下一个 `.js` 文件，不需要配套 JSON。发布信息直接读取脚本自己的 `getSiteInfo()`：

```text
scripts/
  example.js
```

`example.js` 中的站点信息示例：

```js
function getSiteInfo() {
    return JSON.stringify({
        id: "example",
        name: "示例站点",
        group: "影视",
        version: 1,
        desc: "站点说明",
        author: "作者名称" // 可选
    });
}
```

- `id` 使用 1–80 个小写字母、数字、点、下划线或连字符，首字符为字母或数字；同一源内必须唯一，发布后保持不变。
- JS 必须是 UTF-8 编码，符合 zPlayer 的站点脚本契约。`id`、`name`、`group`、`version` 必填；`desc`、`author` 可选。
- 元数据字段使用直接写出的字符串或整数，不调用函数、拼接变量或使用展开属性。支持注释、单引号、双引号和尾逗号。发布程序使用语法树解析，不会执行站点 JS。
- 更新脚本时，只递增 `getSiteInfo().version` 这一处正整数版本号。相同版本不能替换成不同内容。
- 不要把 Cookie、Token、密码写入公开脚本；需要登录的站点通过参数声明让用户在本地填写。
- 初次迁移只需把实际 JS 加入 `scripts/`，并在原有 `getSiteInfo()` 中补上稳定的 `id`。名称、分组、版本和说明不需要再写一遍。
- 根目录的 `source.json` 只描述整个订阅源；发布目录 `index.json`、下载地址和 SHA-256 都自动生成，不需要逐脚本维护。

本地验证和生成：

```powershell
npm ci --ignore-scripts
npm test
npm run build
```

本地需要 Node.js 24 或更高版本。生成结果在 `_site/`，它是临时发布产物，不提交到 Git。工作流在合并到 `main` 后自动生成并发布 `index.json` 和 JS 文件。

## 投稿

请阅读 [贡献说明](CONTRIBUTING.md)。其他作者可以通过 Fork 和 PR 投稿，也可以按同样格式维护自己的订阅源。

## 安装与更新

- 播放器只更新已从此源安装的脚本，不会自动安装整个源，也不会接管旧的本地脚本。
- 订阅和下载地址都必须使用 HTTPS。文件摘要只证明与目录记录一致，不代替作者信任或代码审核。
- 本地修改过的脚本不会被覆盖；更新保留一个上一版本，支持在客户端回退。
- 移除订阅不会卸载已安装脚本，目录下载失败时客户端可使用缓存。
- 当前仅使用 GitHub Pages，没有其他下载镜像。

协议版本为 `schemaVersion: 1`。目录最多 2 MiB、5000 个脚本，单脚本最多 4 MiB。

本仓库采用 [MIT License](LICENSE)。
