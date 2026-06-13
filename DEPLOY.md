# 部署说明

本项目需要 Node.js 后端，不能只部署到 GitHub Pages。推荐部署到 Render、Railway、Fly.io 等支持 Node Web Service 的平台。

## Render 部署

1. 将本仓库推送到 GitHub。
2. 打开 Render，选择 `New` -> `Blueprint`。
3. 连接 `yayueli941118-art/campus-cafe-sandbox` 仓库。
4. Render 会读取 `render.yaml`，创建 `campus-cafe-sandbox` Web Service。
5. 部署完成后，Render 会生成一个固定域名，例如：

```text
https://campus-cafe-sandbox.onrender.com
```

固定入口：

```text
学生端：https://campus-cafe-sandbox.onrender.com/student/
教师大屏：https://campus-cafe-sandbox.onrender.com/dashboard/
```

## 注意

- 免费服务可能会休眠，第一次访问需要等待几十秒启动。
- 课堂正式使用前，先打开教师大屏唤醒服务。
- 当前数据使用本地 JSON 文件保存，适合课堂即时演示；服务重新部署或重启后，历史数据可能清空。
