# CampusBites Lite

一个纯本地的校园菜单查询示例：Node.js + TypeScript + Hono，支持网页筛选和 QQ 群机器人。不需要模型 API Key，也不下载模型。

## 功能

- 按完整菜名、校区和最高价格筛选真实菜单，每次最多展示三家店。
- 少量明确句式：`牛肉面`、`我想吃牛肉面`、`推荐西苑20元以内的牛肉面`。
- `随便推荐` 从本校菜单中随机挑选。
- QQ 只响应允许群内的机器人提及；消息去重、每用户每群每分钟10次、本地反馈记录。
- 反馈采用普通文本命令，仅原提问者可操作，不依赖富文本或按钮权限。

不支持自由聊天、语义近似搜索、复杂条件组合、上下文追问、评论检索或 `/查`。不理解的表达会返回使用提示，不会悄悄删除要求。

## 本地启动

要求 Node.js 24 或以上。SQLite 依赖在没有适用预编译包时需要本机 C++ 构建工具。

```sh
npm ci
npm run typecheck
npm test
npm run dev
```

打开 http://127.0.0.1:8787 。默认只有 `examples/catalog.json` 的四条**虚构演示数据**。网页只监听本机，不要直接开放到公网。

## 导入自己的菜单

复制示例 JSON 到 `.local/catalog.json`，设置 `CATALOG_FILE=.local/catalog.json` 后启动。每个条目：

```json
{
  "id": 1,
  "schoolId": 1,
  "shopId": 1,
  "shopName": "演示面馆",
  "name": "牛肉面",
  "area": "西苑",
  "priceCents": 1500,
  "unit": "item"
}
```

- `id` 全目录唯一；`schoolId` 和 `shopId` 是正整数。
- `priceCents` 以分计，未知填 `null`；`area` 未知填 `null`。
- `unit` 为 `item`（菜单条目价格）、`weight`（按重量）或 `unknown`。
- 预算筛选只使用已知的条目价格；未知或称重价格不会冒充整份价格。
- JSON 应仅含有权使用的有效菜单；不读取业务用户表，不修改业务数据库。
- 网页学校通过 `SCHOOL_ID` 配置，默认1；调用方不能通过请求改学校范围。

## QQ 接入（可选）

使用社区 SDK `qq-official-bot`，不是腾讯官方维护的 SDK。需要自己的 QQ 机器人应用，并按平台要求将机器人加入测试群。

复制 `.env.example` 为 `.env.bot`，填写：

```dotenv
APPID=你的应用ID
APPSECRET=你的应用密钥
QQ_ALLOWED_GROUPS=平台的group_openid
QQ_SCHOOL_ID=1
CATALOG_FILE=examples/catalog.json
QQ_SEND_ENABLED=1
```

`QQ_ALLOWED_GROUPS` 可用逗号分隔，只使用平台的群 openid，不是普通群号。精简版没有自动配对流程。

```sh
npm run qq
```

群内 `@机器人 我想吃牛肉面`。有结果时会附上 `/准 <编号>` 和 `/不准 <编号>`；复制其中一条并 @机器人发送即可。普通帮助/无结果不附反馈命令。相同消息不会重复发送；发送失败不会自动重试，以免重复回复。

**同一机器人应用不要同时运行多个连接实例。**此项目不会自动加载其他软件的密钥，也不会主动群发。

## 数据与限制

`.local/` 和 `.env*` 被 Git 忽略。QQ 的去重、限流及反馈保存在 `.local/private/qq.sqlite`；不存原始问题、回复正文或评论。库内包含群/用户作用域标识，仅应留在本机，反馈保存7天；运行时每分钟清理过期记录。

没有 LLM、Agent、向量检索、评论索引或自动语料学习。QQ 网络传输仍然依赖腾讯服务；“本地”指查询计算和目录存储。

## 开发

- `src/fast-query.ts`：基础句式解析。
- `src/engine.ts`：目录过滤、随机选择及固定回复。
- `src/app.ts`：本地网页及 JSON API。
- `src/qq-protocol.ts`：平台消息规范化。
- `src/qq-handler.ts`、`src/qq-state.ts`：群范围、反馈、去重和限流。

本地测试使用虚构菜单和模拟 QQ 发送，不会连接真实群。测试通过不等同于平台接入验收。

## 发布状态

这是待发布候选版本，尚未确定开源许可证。正式公开前需由维护者确认许可证及所有素材的分发权。
