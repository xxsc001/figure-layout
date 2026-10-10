# GitHub Pages 发布

此版本基于 Resky0/layout-assistant，保留原 MIT 许可证与作者署名。

在 GitHub 建立公开仓库，将本项目源码推送到 main 分支，然后在 Settings → Pages → Build and deployment 中将 Source 设为 GitHub Actions。

项目已配置自动构建发布：推送 main 后安装依赖、构建 dist 并部署 GitHub Pages。相对资源路径同时兼容仓库子路径和自定义域名。

网页不会上传使用者的原图和工程。切换到新网址后，在通用设置中选择“一键恢复备份”，从原备份目录迁移数据并重新授权目录访问。

请勿将 node_modules、artifacts、个人 .figgrid 工程或备份目录提交到公开仓库。
