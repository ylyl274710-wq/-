# 网站部署

个人体验版已于 2026-10-22 发布到 Cloudflare Pages：https://piece-by-piece-puzzle.pages.dev/ 。使用 `npm run build:personal` 构建后直接上传 dist 静态文件，详见 [个人体验版发布记录](PERSONAL_RELEASE.md)。下文 Vercel 与独立后端的完整功能方案暂缓，尚未部署后端；本次没有开通付费资源。

## 后续完整功能：Vercel前端 + 独立Node后端

状态：代码和部署配置已准备，尚未创建云资源或发布公网地址。实际部署需要连接 Vercel 账号，以及后端服务账号或提供现成服务器。付费服务须先核对账单并获得授权。

## 架构

Vercel 托管 Vite 构建的 `dist/`。浏览器通过 HTTPS 直接请求独立后端，JSON 和 SSE 共用 `VITE_API_ORIGIN`。普通单人游戏及导出继续在浏览器处理；主动创建房间或照片分享时才向后端发送处理后的照片。

后端保持一个持续运行的 Node 进程和一块持久磁盘，保存房间、图片及凭据；SSE 连接用于同步。当前内存房间状态与长连接不支持多个独立副本，请保持单实例。不要把当前 `server/index.ts` 直接当成无状态函数部署。

## 已准备的文件

- `vercel.json`：Vite 框架、`npm ci --include=dev`、`npm run build`、输出 `dist`。现有导航使用 hash，无需将所有请求重写到首页。
- `.vercelignore`：排除 `.local` 用户照片与房间、调试记录、依赖、压缩包、生成源码文档及环境变量文件。不会将本机已有房间和照片迁移到云端。
- `.env.example`：前端后端地址示例，不包含任何密钥。
- `render.yaml`：待审核的 Render 部署方案，新加坡单实例 `0.5c-512mb`，1GB持久磁盘，关闭自动部署。应用这个文件会产生服务与磁盘费用，本轮未应用。
- `src/lib/apiEndpoint.ts`：统一 JSON 与 SSE 地址，留空保持本地同源代理；拒绝公网 HTTP、凭据、路径、查询参数和片段误配。
- `server/origin.ts`：仅允许同源或配置的精确前端来源，处理 OPTIONS；JSON、错误响应和 SSE 返回对应 CORS 头，不使用通配域名或跨站 Cookie。

## 部署参数

### Vercel

| 设置 | 值 |
| --- | --- |
| 项目目录 | 项目根目录 |
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm ci --include=dev` |
| Production 环境变量 | `VITE_API_ORIGIN=https://实际后端域名` |

`VITE_API_ORIGIN` 只填后端 HTTPS origin，不追加 `/api`，不是密钥。Vite 在构建时写入地址，修改后需要重新部署。所有密码和云服务令牌都不要使用 `VITE_` 前缀或提交进代码。

### Render 或其他持续运行的 Node 托管

| 设置 | 值 |
| --- | --- |
| Node | 22 |
| Build | `npm ci --include=dev && npm run build` |
| Start | `npm run server` |
| Health check | `/api/health` |
| 实例 | 1个 |
| 持久磁盘 | `/var/data`，初始1GB |
| `STUDIO_DATA_DIR` | `/var/data/puzzle` |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `PUBLIC_ORIGIN` | 实际生产前端 origin，例如 `https://your-project.vercel.app`，不带末尾斜线 |

后端识别平台提供的 `PORT`，也兼容原有 `API_PORT`，不设置时仍为5175。Render可自动提供PORT，不需手填。使用自己的服务器时，也可设置API_PORT并在前面配置HTTPS反向代理；SSE需关闭代理缓冲。

持久磁盘只能用于 Render 付费服务。免费服务没有持久磁盘，文件会在重启或部署后丢失，因此本方案没有用免费临时磁盘保存用户照片。核对服务计算费、1GB磁盘费、流量超额费和账户预算后再创建；此配置不是费用封顶承诺。

## 发布顺序

1. 连接 Vercel 并创建/选择项目，确定稳定的生产域名；先准备项目配置，不把未接通后端的版本标为完整上线。
2. 确认后端托管账户、具体套餐和预算。使用Render时，核对 `render.yaml` 后再授权创建服务与磁盘；使用现成服务器时，提供其可用HTTPS地址。
3. 后端填入精确的 `PUBLIC_ORIGIN`、持久目录及端口设置。启动后检查健康接口和磁盘挂载。
4. Vercel设置 `VITE_API_ORIGIN` 为实际后端地址并构建部署；后端更新为实际前端生产域名。预览域名若未单独允许，不能用于联机，不要放宽成所有 `*.vercel.app`。
5. 通过手机和电脑在生产网址创建/加入、双向放置、提示、刷新恢复；测试照片分享创建、读取和撤回；重启后端确认房间和照片记录仍可读取。
6. 完成验收后交付可访问的生产网址。不能仅凭构建成功或健康接口返回200宣布完整功能上线。

## 本机开发

不创建 `.env` 或保持 `VITE_API_ORIGIN` 留空，`npm start` 与原有 `npm start -- --host 192.168.1.4 --port 5174` 继续使用Vite代理，不需要云账户。本轮没有重启正在使用的本机房间服务。

线上服务从空的持久目录开始，本机旧房间链接不会自动转为云端链接；需在线上重新创建。收藏、文字草稿和房间管理凭据按浏览器来源隔离，更换域名不会自动迁移这些本机数据。

## 验证范围

已有回归覆盖同源代理及真实图片请求、创建加入和SSE同步；新增覆盖HTTPS后端地址校验、独立前后端的OPTIONS、照片读取、SSE的CORS、错误响应可读性和恶意来源拒绝。测试使用临时数据目录，不访问本机用户照片。

本轮 `npm test` 56项全部通过，严格TypeScript与生产构建通过；另外在独立验证目录构建了配置HTTPS后端地址的版本，确认地址已写入构建产物。

本地测试和构建无法替代云端域名、账号、磁盘挂载与真实网络验收。账号尚未连接时应明确标为“待部署”，不生成虚假的上线地址。

## 官方参考

- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel Functions限制](https://vercel.com/docs/functions/limitations)
- [Render持久磁盘](https://render.com/docs/disks)
- [Render Blueprint规格](https://render.com/docs/blueprint-spec)
- [Render现行费用](https://render.com/pricing)

