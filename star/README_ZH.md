# Star

[English](./README.md)

Star 是一个基于 Go `net/http` 标准库的轻量级 Web 框架。它把路由、参数绑定、中间件、路由守卫、统一响应、WebSocket、静态文件和 SPA 回退封装在一个很小的 API 面里，适合用来快速写 HTTP 服务、后台接口或小型前后端一体应用。

项目当前模块名为 `star`，Go 版本要求见 [go.mod](./go.mod)。

## 特性

- 基于 `net/http`，核心代码轻量，运行模型直接
- 单例应用实例，`New()` 初始化后通过 `Use()` 统一注册组件
- 支持普通路由、嵌套路由、路径参数、可选路径参数和 `ANY` 方法
- 支持 Query / Body DTO 自动绑定，并可通过 `Validator` 做请求校验
- 支持全局中间件、局部中间件、前置路由守卫和后置路由守卫
- 内置 Recover、Request-ID、访问日志、CORS、按 IP + Path 限流
- 支持 WebSocket、静态文件服务和 SPA 前端路由回退
- 提供 JSON / HTML 响应、Cookie、Header、上下文数据和工具函数

## 快速开始

```go
package main

import "star"

func main() {
	star.New(":8080")

	star.Use(star.Route{
		Method: star.GET,
		Path:   "/hello",
		Handler: func(ctx *star.Context) *star.Response {
			return &star.Response{
				Status:  true,
				Message: "success",
				Data:    "Hello, Star!",
			}
		},
	})

	star.Run()
}
```

启动后访问：

```bash
curl http://localhost:8080/hello
```

响应：

```json
{
    "status": true,
    "message": "success",
    "data": "Hello, Star!"
}
```

## 应用模型

Star 的入口只有三个核心动作：

1. `star.New(":8080")` 创建全局应用实例
2. `star.Use(...)` 注册路由、中间件或路由守卫
3. `star.Run()` 展开路由、套用中间件并启动 HTTP Server

`New()` 默认注册三个内置中间件：

- `RecoverMiddleware()`：捕获 panic 并返回 500
- `RequestIdMiddleware()`：生成请求 ID，并写入 `Request-ID` 响应头
- `LogMiddleware()`：记录方法、状态码、路径、IP、请求 ID、耗时和 UA

如果你想完全手动控制中间件，可以关闭默认中间件：

```go
star.New(":8080", false)
```

## 路由

通过 `star.Route` 描述一个路由，通过 `star.Use()` 注册。

```go
star.Use(star.Route{
	Method: star.GET,
	Path:   "/users",
	Handler: func(ctx *star.Context) *star.Response {
		return &star.Response{Status: true, Message: "success"}
	},
})
```

支持的方法：

```go
star.GET
star.POST
star.PUT
star.DELETE
star.PATCH
star.OPTIONS
star.HEAD
star.ANY
```

如果普通路由没有设置 `Method`，根级路由默认使用 `ANY`；子路由会优先继承父路由的 `Method`。

### 路径参数

路径参数使用 `{name}` 定义，默认类型为字符串。

```go
star.Use(star.Route{
	Method: star.GET,
	Path:   "/user/{id:int}",
	Handler: func(ctx *star.Context) *star.Response {
		id := ctx.GetParam("id") // int64
		return &star.Response{Status: true, Data: id}
	},
})
```

支持的路径参数类型：

| 类型    | Go 值                                                                              |
| ------- | ---------------------------------------------------------------------------------- |
| `str`   | `string`                                                                           |
| `int`   | `int64`                                                                            |
| `float` | `float64`                                                                          |
| `bool`  | `bool`，支持 `true` / `false` / `1` / `0`                                          |
| `time`  | `time.Time`，支持 RFC3339、`2006-01-02 15:04:05`、`2006-01-02`、秒级或毫秒级时间戳 |

可选参数使用 `?`，并且必须提供默认值：

```go
star.Use(star.Route{
	Method: star.GET,
	Path:   "/list/{page?:int:1}/{size?:int:10}",
	Handler: func(ctx *star.Context) *star.Response {
		return &star.Response{Status: true, Data: ctx.GetParams()}
	},
})
```

`/list` 会得到：

```json
{
    "page": 1,
    "size": 10
}
```

### 嵌套路由

`Children` 可以组织分组路由。子路由会继承父级路径、局部中间件、Meta 和未显式声明的 Method。

```go
star.Use(star.Route{
	Path: "/api",
	Children: []star.Route{
		{
			Method: star.GET,
			Path:   "v1/status",
			Handler: func(ctx *star.Context) *star.Response {
				return &star.Response{Status: true, Data: "v1 running"}
			},
		},
	},
})
```

上面的路由会注册为：

```text
GET /api/v1/status
```

### 路由元数据

`Meta` 用来给路由挂载业务侧元信息。父子路由的 `Meta` 会浅合并，同名字段以子路由为准。

```go
star.Use(star.Route{
	Path: "/admin",
	Meta: map[string]any{
		"auth": map[string]any{"role": "admin"},
	},
	Children: []star.Route{
		{
			Method: star.GET,
			Path:   "dashboard",
			Handler: func(ctx *star.Context) *star.Response {
				role := ctx.GetMeta("auth.role")
				return &star.Response{Status: true, Data: role}
			},
		},
	},
})
```

## DTO 绑定和校验

`Route.Query` 和 `Route.Body` 可以声明绑定模型。Star 会把请求数据转成结构体，并在模型实现 `Validator` 时自动调用 `Validate()`。

### Query 绑定

```go
type UserQuery struct {
	Name string `json:"name"`
	Age  int    `json:"age"`
}

func (q UserQuery) Validate(ctx *star.Context) error {
	if q.Name == "" {
		return fmt.Errorf("name is required")
	}
	return nil
}

star.Use(star.Route{
	Method: star.GET,
	Path:   "/user/{id:int}",
	Query:  UserQuery{},
	Handler: func(ctx *star.Context) *star.Response {
		id := ctx.GetParam("id")
		query := ctx.GetQueryModel().(UserQuery)
		return &star.Response{
			Status: true,
			Data:   map[string]any{"id": id, "query": query},
		}
	},
})
```

也可以手动读取：

```go
ctx.GetQuery("name")
ctx.GetQuery("age", star.StarTypeInt)
ctx.GetQueries()
ctx.GetQueries(map[string]star.StarType{"age": star.StarTypeInt})
```

### Body 绑定

Body 支持：

- `application/json`
- `application/x-www-form-urlencoded`
- `multipart/form-data`

```go
type CreateUserBody struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

func (b CreateUserBody) Validate(ctx *star.Context) error {
	if b.Name == "" || b.Email == "" {
		return fmt.Errorf("name and email are required")
	}
	return nil
}

star.Use(star.Route{
	Method: star.POST,
	Path:   "/user",
	Body:   CreateUserBody{},
	Handler: func(ctx *star.Context) *star.Response {
		body := ctx.GetBodyModel().(CreateUserBody)
		return &star.Response{Status: true, Message: "created", Data: body}
	},
})
```

手动读取 Body：

```go
ctx.GetBody("name")
ctx.GetBodyAll()
```

## 响应

Handler 返回 `*star.Response`，框架会统一输出 JSON。

```go
type Response struct {
	Status  bool   `json:"status"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
	Extra   any    `json:"extra,omitempty"`
	Stack   string `json:"stack,omitempty"`
}
```

`Status` 表示业务是否成功；HTTP 层成功时默认返回 `200`。如果需要手动控制响应，可以使用 `Context`：

```go
ctx.Json(201, map[string]any{"id": 1})
ctx.Html(200, "<h1>{{.Title}}</h1>", map[string]any{"Title": "Star"})
ctx.ResponseError(400, fmt.Errorf("bad request"))
```

当 handler 返回 `nil`，或请求已经被 `ctx.Json()` / `ctx.Html()` / `ctx.ResponseError()` 消费，框架不会再写第二次响应。

## 中间件

中间件类型：

```go
type Middleware func(next star.Handler) star.Handler
```

全局中间件：

```go
star.Use(func(next star.Handler) star.Handler {
	return func(ctx *star.Context) *star.Response {
		ctx.AddContext("start", time.Now())
		return next(ctx)
	}
})
```

局部中间件：

```go
star.Use(star.Route{
	Path: "/admin",
	Middleware: []star.Middleware{
		func(next star.Handler) star.Handler {
			return func(ctx *star.Context) *star.Response {
				ctx.AddContext("role", "admin")
				return next(ctx)
			}
		},
	},
	Handler: func(ctx *star.Context) *star.Response {
		return &star.Response{Status: true, Data: ctx.GetContext("role")}
	},
})
```

内置中间件：

| 中间件                                 | 说明                              |
| -------------------------------------- | --------------------------------- |
| `RecoverMiddleware()`                  | panic 恢复，返回 500              |
| `RequestIdMiddleware()`                | 生成 UUID 请求 ID                 |
| `LogMiddleware()`                      | 输出 HTTP 访问日志                |
| `CorsMiddleware(config ...CorsConfig)` | 设置跨域响应头并处理 OPTIONS 预检 |
| `RateLimitMiddleware(requests, per)`   | 按 IP + Path 限流，超限返回 429   |

## 路由守卫

前置守卫在匹配路由之后、DTO 绑定之前执行。返回非 `nil` 响应或提前消费请求会中断后续流程。

```go
star.Use(star.BeforeRouteGuard(func(ctx *star.Context) *star.Response {
	if ctx.GetRequestHeader("Authorization") == "" {
		return &star.Response{Status: false, Message: "unauthorized"}
	}
	return nil
}))
```

后置守卫在 handler 之后执行，可以替换最终响应。

```go
star.Use(star.AfterRouteGuard(func(ctx *star.Context, resp *star.Response) *star.Response {
	if resp == nil {
		return nil
	}
	resp.Extra = map[string]any{"requestId": ctx.RequestID}
	return resp
}))
```

守卫按照注册顺序执行。

## CORS

```go
star.ConfigureCors(star.CorsConfig{
	AllowOrigins:     []string{"https://example.com"},
	AllowMethods:     []string{"GET", "POST", "PUT", "DELETE"},
	AllowHeaders:     []string{"Content-Type", "Authorization"},
	ExposeHeaders:    []string{"Request-ID"},
	AllowCredentials: true,
	MaxAge:           86400,
})
```

未配置时，`CorsMiddleware()` 默认允许所有 Origin、Method 和 Header。`OPTIONS` 请求会自动返回 `204 No Content`。

WebSocket 默认升级器会复用当前 CORS Origin 匹配逻辑。

## WebSocket

```go
star.Use(star.Route{
	Path:        "/ws",
	IsWebSocket: true,
	Handler: func(ctx *star.Context) *star.Response {
		conn := ctx.GetWebSocket()
		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				break
			}
			_ = conn.WriteMessage(1, msg)
		}
		return nil
	},
})
```

说明：

- `IsWebSocket: true` 时路由方法固定为 `GET`
- 非 WebSocket 握手请求会返回 `400`
- 可通过 `WebsocketUpgrade` 传入自定义 `*websocket.Upgrader`
- 连接对象通过 `ctx.GetWebSocket()` 获取

## 静态文件和 SPA

静态文件：

```go
star.Use(star.Route{
	Path:      "/static",
	IsStatic:  true,
	StaticDir: "./static",
})
```

请求 `/static/style.css` 会读取 `./static/style.css`。

SPA：

```go
star.Use(star.Route{
	Path:     "/app",
	IsSPA:    true,
	SPADir:   "./web",
	SPAIndex: "index.html",
})
```

SPA 模式下，如果请求路径对应的文件不存在或是目录，会回退到 `index.html`，方便前端路由接管。

## 日志和调试

开启调试模式：

```go
star.EnableDebug()
```

调试模式会输出 DEBUG 日志；500 错误响应会带 `Stack`。

开启日志落盘：

```go
star.EnableLogSave()
```

自定义日志配置：

```go
star.EnableLogSave(star.Logger{
	FileDir: "./log",
	MaxSize: 30 * 1024, // KB；-1 表示不按大小分片
	MaxAge:  7,         // 天；-1 表示不清理
})
```

日志文件按日期命名：

```text
2026-05-22.log
2026-05-22_001.log
2026-05-22_002.log
```

终端颜色可通过环境变量关闭：

```bash
NO_COLOR=1
TERM=dumb
```

## Context 常用方法

请求信息：

| 方法                          | 说明                              |
| ----------------------------- | --------------------------------- |
| `GetPath()`                   | 当前请求路径，已规范化            |
| `GetRequestMethod()`          | 原始请求方法                      |
| `GetMethod()`                 | 当前命中的路由方法                |
| `GetClientIP()`               | IP 链，优先解析 `X-Forwarded-For` |
| `GetOriginalRequest()`        | 原始 `*http.Request`              |
| `GetOriginalResponseWriter()` | 原始 `http.ResponseWriter`        |

参数和模型：

| 方法                                        | 说明                         |
| ------------------------------------------- | ---------------------------- |
| `GetParam(key)`                             | 获取单个路径参数             |
| `GetParams()`                               | 获取全部路径参数             |
| `GetQuery(key, typ ...StarType)`            | 获取单个 Query，可选类型转换 |
| `GetQueries(typMap ...map[string]StarType)` | 获取全部 Query               |
| `GetQueryModel()`                           | 获取绑定后的 Query DTO       |
| `GetBody(key)`                              | 获取 Body 字段               |
| `GetBodyAll()`                              | 获取解析后的 Body Map        |
| `GetBodyModel()`                            | 获取绑定后的 Body DTO        |

请求改写：

| 方法                            | 说明                             |
| ------------------------------- | -------------------------------- |
| `SetQueries(map[string]string)` | 重写 Query 参数                  |
| `SetBody(string)`               | 重写请求体，并重置 Body 解析缓存 |

响应控制：

| 方法                          | 说明                           |
| ----------------------------- | ------------------------------ |
| `SetStatusCode(code)`         | 写入 HTTP 状态码，只会生效一次 |
| `GetStatusCode()`             | 获取当前 HTTP 状态码，默认 200 |
| `SetHeader(key, value)`       | 设置响应头                     |
| `AddHeader(key, value)`       | 追加响应头                     |
| `RemoveHeader(key)`           | 删除响应头                     |
| `GetResponseHeader(key)`      | 获取响应头                     |
| `GetResponseHeaders()`        | 获取全部响应头                 |
| `Json(status, data)`          | 输出 JSON                      |
| `Html(status, tmpl, data...)` | 输出 HTML，模板会做 LRU 缓存   |
| `ResponseSuccess(response)`   | 输出 200 JSON                  |
| `ResponseError(code, err...)` | 输出错误响应                   |

Cookie：

| 方法                            | 说明            |
| ------------------------------- | --------------- |
| `GetCookie(key)`                | 读取 Cookie     |
| `GetCookies()`                  | 读取全部 Cookie |
| `SetCookie(key, value, maxAge)` | 设置 Cookie     |
| `DeleteCookie(key)`             | 删除 Cookie     |

上下文和扩展：

| 方法                     | 说明                                        |
| ------------------------ | ------------------------------------------- |
| `AddContext(key, value)` | 写入请求级上下文数据                        |
| `GetContext(key)`        | 读取上下文数据，支持 `a.b` 和 `items[0].id` |
| `DelContext(key)`        | 删除上下文数据                              |
| `GetMeta(key)`           | 读取路由元数据，支持多级路径                |
| `IsWebSocket()`          | 判断是否是 WebSocket 握手                   |
| `GetWebSocket()`         | 获取 WebSocket 连接                         |

## 全局 API

| API                                              | 说明                   |
| ------------------------------------------------ | ---------------------- |
| `New(bind string, useDefaultMiddleware ...bool)` | 初始化 Star 实例       |
| `Run()`                                          | 启动 HTTP Server       |
| `Use(component)`                                 | 注册路由、中间件或守卫 |
| `EnableDebug()`                                  | 开启调试模式           |
| `EnableLogSave(config ...Logger)`                | 开启日志落盘           |
| `ConfigureCors(config CorsConfig)`               | 注册 CORS 中间件       |

`Use()` 支持的组件类型：

```go
star.Route
[]star.Route
star.Middleware
[]star.Middleware
star.BeforeRouteGuard
[]star.BeforeRouteGuard
star.AfterRouteGuard
[]star.AfterRouteGuard
```

## 工具函数

| 函数                        | 说明                               |
| --------------------------- | ---------------------------------- |
| `Now()`                     | 当前时间                           |
| `NowFormat(format)`         | 当前时间格式化                     |
| `FormatTime(t, format)`     | 格式化时间                         |
| `ParseDateTime(s)`          | 解析 `2006-01-02 15:04:05`         |
| `ParseTimestamp(s)`         | 解析秒级或毫秒级时间戳             |
| `VerifyTimestamp(s)`        | 校验时间戳字符串                   |
| `GenerateUUID()`            | 生成 UUID v4                       |
| `VerifyUUID(s)`             | 校验 UUID                          |
| `GetValueByPath(obj, path)` | 从 map、struct、slice 中按路径取值 |

## 在其他项目中引用

当前仓库模块名为 `star`。如果在本地项目中引用，可以在你的 `go.mod` 中添加 `replace`：

```go
module your-app

go 1.26.1

require star v0.0.1

replace star => ../star
```

然后在代码中导入：

```go
import "star"
```

## 目录结构

```text
.
├── app.go          # 应用初始化、启动和全局配置
├── router.go       # 路由定义、嵌套路由展开、Meta 合并
├── handler.go      # HTTP 适配、路由匹配、DTO 绑定、WebSocket/静态/SPA 包装
├── ctx.go          # 请求上下文、参数读取、响应输出
├── middleware.go   # 中间件、CORS、限流、Recover、日志请求记录
├── log.go          # 日志输出和落盘
├── template.go     # 默认页面和错误页面模板
├── utils.go        # UUID、路径取值、堆栈工具
├── date.go         # 时间工具
└── demo            # 示例应用
```

## License

MIT
