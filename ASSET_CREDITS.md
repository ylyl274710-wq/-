# 闯关素材来源

## 原创插画与合成音效

- `public/sample.svg` 为本项目原创「山野来信」插画。
- `src/lib/catalog.ts` 包含本项目原创「林间的狐狸」「树下的猫头鹰」「雪地来信」SVG 插画，用于动物主题与每日挑战；在浏览器本地生成。
- `src/lib/ambience.ts` 用 Web Audio 合成雨声、壁炉和海浪，不含第三方录音或采样。
- `src/lib/shredderSound.ts` 用 Web Audio 合成电机、纸张粉碎及收尾音效，不含第三方录音或采样。

## 名画来源

来源：芝加哥艺术博物馆（Art Institute of Chicago）官方开放 API。六件作品均已核实官方 is_public_domain 为 true。核实日期：2026-10-19。

[官方图片使用说明](https://www.artic.edu/image-licensing) · [官方 API 文档](https://api.artic.edu/docs/)

| 关卡 | 作品 | 作者 | 官方来源 | 本地文件 |
| --- | --- | --- | --- | --- |
| 1 | 阿尔的卧室 / The Bedroom | Vincent van Gogh | [馆藏原作](https://www.artic.edu/artworks/28560) · [元数据](https://api.artic.edu/api/v1/artworks/28560) | public/levels/bedroom.jpg |
| 2 | 神奈川冲浪里 / Under the Wave off Kanagawa (Kanagawa oki nami ura), also known as The Great Wave, from the series "Thirty-Six Views of Mount Fuji (Fugaku sanjūrokkei)" | Katsushika Hokusai | [馆藏原作](https://www.artic.edu/artworks/24645) · [元数据](https://api.artic.edu/api/v1/artworks/24645) | public/levels/great-wave.jpg |
| 3 | 雨天的巴黎街道 / Paris Street; Rainy Day | Gustave Caillebotte | [馆藏原作](https://www.artic.edu/artworks/20684) · [元数据](https://api.artic.edu/api/v1/artworks/20684) | public/levels/paris-rain.jpg |
| 4 | 博尔迪盖拉 / Bordighera | Claude Monet | [馆藏原作](https://www.artic.edu/artworks/81537) · [元数据](https://api.artic.edu/api/v1/artworks/81537) | public/levels/bordighera.jpg |
| 5 | 大碗岛的星期天下午 / A Sunday on La Grande Jatte — 1884 | Georges Seurat | [馆藏原作](https://www.artic.edu/artworks/27992) · [元数据](https://api.artic.edu/api/v1/artworks/27992) | public/levels/grande-jatte.jpg |
| 6 | 睡莲 / Water Lilies | Claude Monet | [馆藏原作](https://www.artic.edu/artworks/16568) · [元数据](https://api.artic.edu/api/v1/artworks/16568) | public/levels/water-lilies.jpg |

原图以官网 IIIF 的1686px宽版本逐张下载；缩略图为居中裁剪的400px WebP。游戏完整拼图仍从高清原图经同一Canvas管线裁剪。网站不暗示博物馆为本游戏背书。完整image_id、下载链接、文件长度与SHA-256见 public/levels/credits.json。

## 原创背景音乐

`public/audio/slow-morning.wav`：为本项目编写音符、和声及合成脚本生成的「山间慢调」，32秒、22050Hz、单声道16位PCM循环音乐；不使用第三方录音或采样。生成脚本为`scripts/generate-music.py`，只依赖Python标准库；前端播放不需要Python。

## QQ音乐外部入口

「去 QQ 音乐听」只链接到QQ音乐官方网页，用户可以在浏览器本地保存官方歌曲或歌单分享链接。本站不存储、播放、抓取或转发QQ音乐音频，也不使用其封面、歌词或官方标志作为本站素材。QQ音乐服务由其平台提供，网站不暗示与QQ音乐存在合作或授权关系。
