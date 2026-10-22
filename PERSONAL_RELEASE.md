# 个人体验版发布记录

2026-10-21，用户选择先上线个人体验，联机和照片云分享稍后处理。

## 本次范围

保留自定义图片、随机不规则切片、手绘轮廓、困难模式、提示、粉碎动画及音效、名画闯关、每日与每周内容、原创音乐、本地保存、收藏、分享卡和过程回放导出。照片在浏览器中处理，不上传到服务器。

首页三个入口为「自定义拼图」「闯关模式」「收藏时光」。发布版本收起双人联机、云端礼物及照片分享管理；游戏工具条不提供创建房间。旧的房间或照片分享 hash 会返回首页并说明当前是个人体验版，不发起联网请求。创意工坊保留本机玩法和文件包，收起服务器功能。

## 构建与发布

```powershell
cd E:\codex\拼图
npm run build:personal
```

`scripts/build-personal.mjs` 执行严格类型检查，构建时强制 `VITE_PERSONAL_ONLY=true` 并清空后端地址。`vercel.json` 当前默认使用这个命令。`npm run dev` 和 `npm start` 不改变原有完整本机开发版；后续恢复完整云端版时，先部署后端并把Vercel构建命令改回 `npm run build`。

已生成仅含 `dist` 静态产物的独立上传目录：`C:\Users\Lenovo\Documents\ChatGPT\拼图\.staging\personal-publish-20261021`。没有本机照片、房间数据、凭据、源码仓库或环境文件。

2026-10-22，已在用户自己的 Cloudflare Pages 账户通过 Direct Upload 发布个人体验版。项目为 `piece-by-piece-puzzle`，正式地址为 https://piece-by-piece-puzzle.pages.dev/ 。控制台明确显示部署成功，35/35 个静态文件上传完成，未开通付费服务。上传包只包含 dist 静态文件，不包含用户照片、房间数据、凭据、环境文件或源码。Vercel 注册受阻后未继续部署 Vercel。

## 验收

- 个人版严格TypeScript及生产构建通过。
- 最终56项现有回归测试通过。期间代理集成用例曾出现一次超时，已补充失败阶段信息，单独和最终整套复验通过；不将其描述为已解决的间歇性问题。该联网功能不在个人体验版中开放。
- 浏览器验证：首页三个个人入口；一键试玩显示粉碎动画；手动放置全部9片并正确完成；完成页保留分享卡及收藏入口，收起寄礼物入口。
- 访问旧照片链接时返回首页并显示明确说明，没有控制台错误。
- 本机预览为 `http://127.0.0.1:5180/`，它只用于验收。公网 HTTPS 首页、一键试玩、不规则纸片图像、6 幅关卡缩略图加载及锁定状态已在浏览器检查，未发现控制台错误。真实手机及不同网络的访问体验仍需用户实测。

截图保存在 `.verification/personal-home.png` 和 `.verification/personal-completed.png`。登录链接会到期，后续若失效需重新运行官方CLI登录，不在文档中保存设备授权码或任何账户凭据。

## 后续更新 Cloudflare Pages

执行 npm run build:personal，压缩 dist 中的内容，确保 ZIP 根目录直接包含 index.html。进入 Cloudflare 的 Workers & Pages → piece-by-piece-puzzle，创建新的生产部署并上传。当前为直接上传项目，更新代码不会自动发布。

