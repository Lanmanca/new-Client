# Star

[中文文档](./README_ZH.md)

Star is a lightweight Go web framework built on top of the standard `net/http` package. It wraps routing, parameter binding, middleware, route guards, unified responses, WebSocket, static files, and SPA fallback into a small API surface. It is suitable for quickly building HTTP services, backend APIs, and small full-stack applications.

The current module name is `star`. See [go.mod](./go.mod) for the required Go version.

## Features

- Built on `net/http`, with a lightweight core and a straightforward runtime model
- Singleton application instance, initialized with `New()` and extended through `Use()`
- Supports normal routes, nested routes, path parameters, optional path parameters, and `ANY`
- Supports automatic Query / Body DTO binding with optional `Validator` validation
- Supports global middleware, route-level middleware, before-route guards, and after-route guards
- Built-in Recover, Request-ID, access logging, CORS, and IP + Path rate limiting
- Supports WebSocket, static file serving, and SPA frontend route fallback
- Provides JSON / HTML responses, Cookie and Header helpers, request-scoped context data, and utility functions

## Quick Start

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

Visit the endpoint:

```bash
curl http://localhost:8080/hello
```

Response:

```json
{
    "status": true,
    "message": "success",
    "data": "Hello, Star!"
}
```

## Application Model

Star has three core actions:

1. `star.New(":8080")` creates the global application instance
2. `star.Use(...)` registers routes, middleware, or route guards
3. `star.Run()` flattens routes, applies middleware, and starts the HTTP server

`New()` registers three built-in middleware by default:

- `RecoverMiddleware()`: catches panics and returns 500
- `RequestIdMiddleware()`: generates a request ID and writes it to the `Request-ID` response header
- `LogMiddleware()`: logs method, status code, path, IP, request ID, duration, and user agent

If you want full manual control over middleware, disable the default middleware:

```go
star.New(":8080", false)
```

## Routing

Use `star.Route` to describe a route, then register it with `star.Use()`.

```go
star.Use(star.Route{
	Method: star.GET,
	Path:   "/users",
	Handler: func(ctx *star.Context) *star.Response {
		return &star.Response{Status: true, Message: "success"}
	},
})
```

Supported methods:

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

If a normal route does not set `Method`, a root-level route defaults to `ANY`; child routes first inherit the parent route's `Method`.

### Path Parameters

Path parameters are defined with `{name}`. The default type is string.

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

Supported path parameter types:

| Type | Go value |
| --- | --- |
| `str` | `string` |
| `int` | `int64` |
| `float` | `float64` |
| `bool` | `bool`, supports `true` / `false` / `1` / `0` |
| `time` | `time.Time`, supports RFC3339, `2006-01-02 15:04:05`, `2006-01-02`, second timestamps, and millisecond timestamps |

Optional parameters use `?` and must provide a default value:

```go
star.Use(star.Route{
	Method: star.GET,
	Path:   "/list/{page?:int:1}/{size?:int:10}",
	Handler: func(ctx *star.Context) *star.Response {
		return &star.Response{Status: true, Data: ctx.GetParams()}
	},
})
```

`/list` returns:

```json
{
    "page": 1,
    "size": 10
}
```

### Nested Routes

`Children` can be used to group routes. Child routes inherit the parent path, route-level middleware, Meta, and any Method that is not explicitly declared.

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

The route above is registered as:

```text
GET /api/v1/status
```

### Route Metadata

`Meta` attaches business metadata to a route. Parent and child `Meta` maps are shallow-merged, and child fields override parent fields with the same key.

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

## DTO Binding and Validation

`Route.Query` and `Route.Body` can declare binding models. Star converts request data into structs and automatically calls `Validate()` when the model implements `Validator`.

### Query Binding

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

You can also read Query values manually:

```go
ctx.GetQuery("name")
ctx.GetQuery("age", star.StarTypeInt)
ctx.GetQueries()
ctx.GetQueries(map[string]star.StarType{"age": star.StarTypeInt})
```

### Body Binding

Body parsing supports:

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

Read Body values manually:

```go
ctx.GetBody("name")
ctx.GetBodyAll()
```

## Responses

Handlers return `*star.Response`, and the framework writes a unified JSON response.

```go
type Response struct {
	Status  bool   `json:"status"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
	Extra   any    `json:"extra,omitempty"`
	Stack   string `json:"stack,omitempty"`
}
```

`Status` represents business success or failure. When the HTTP layer succeeds, Star returns `200` by default. Use `Context` when you need manual response control:

```go
ctx.Json(201, map[string]any{"id": 1})
ctx.Html(200, "<h1>{{.Title}}</h1>", map[string]any{"Title": "Star"})
ctx.ResponseError(400, fmt.Errorf("bad request"))
```

When a handler returns `nil`, or the request has already been consumed by `ctx.Json()` / `ctx.Html()` / `ctx.ResponseError()`, the framework does not write a second response.

## Middleware

Middleware type:

```go
type Middleware func(next star.Handler) star.Handler
```

Global middleware:

```go
star.Use(func(next star.Handler) star.Handler {
	return func(ctx *star.Context) *star.Response {
		ctx.AddContext("start", time.Now())
		return next(ctx)
	}
})
```

Route-level middleware:

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

Built-in middleware:

| Middleware | Description |
| --- | --- |
| `RecoverMiddleware()` | Recovers from panics and returns 500 |
| `RequestIdMiddleware()` | Generates a UUID request ID |
| `LogMiddleware()` | Writes HTTP access logs |
| `CorsMiddleware(config ...CorsConfig)` | Sets CORS response headers and handles OPTIONS preflight requests |
| `RateLimitMiddleware(requests, per)` | Applies IP + Path rate limiting and returns 429 when exceeded |

## Route Guards

Before-route guards run after route matching and before DTO binding. Returning a non-`nil` response or consuming the request early interrupts the remaining flow.

```go
star.Use(star.BeforeRouteGuard(func(ctx *star.Context) *star.Response {
	if ctx.GetRequestHeader("Authorization") == "" {
		return &star.Response{Status: false, Message: "unauthorized"}
	}
	return nil
}))
```

After-route guards run after the handler and can replace the final response.

```go
star.Use(star.AfterRouteGuard(func(ctx *star.Context, resp *star.Response) *star.Response {
	if resp == nil {
		return nil
	}
	resp.Extra = map[string]any{"requestId": ctx.RequestID}
	return resp
}))
```

Guards run in registration order.

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

When no config is provided, `CorsMiddleware()` allows all Origins, Methods, and Headers by default. `OPTIONS` requests automatically return `204 No Content`.

The default WebSocket upgrader reuses the current CORS Origin matching logic.

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

Notes:

- `IsWebSocket: true` forces the route method to `GET`
- Non-WebSocket handshake requests return `400`
- Pass a custom `*websocket.Upgrader` through `WebsocketUpgrade`
- Get the connection with `ctx.GetWebSocket()`

## Static Files and SPA

Static files:

```go
star.Use(star.Route{
	Path:      "/static",
	IsStatic:  true,
	StaticDir: "./static",
})
```

Requesting `/static/style.css` reads `./static/style.css`.

SPA:

```go
star.Use(star.Route{
	Path:     "/app",
	IsSPA:    true,
	SPADir:   "./web",
	SPAIndex: "index.html",
})
```

In SPA mode, if the requested path does not map to an existing file or maps to a directory, Star falls back to `index.html` so the frontend router can take over.

## Logging and Debugging

Enable debug mode:

```go
star.EnableDebug()
```

Debug mode enables DEBUG logs. 500 error responses include `Stack`.

Enable log persistence:

```go
star.EnableLogSave()
```

Custom log config:

```go
star.EnableLogSave(star.Logger{
	FileDir: "./log",
	MaxSize: 30 * 1024, // KB; -1 disables size-based sharding
	MaxAge:  7,         // days; -1 disables cleanup
})
```

Log files are named by date:

```text
2026-05-22.log
2026-05-22_001.log
2026-05-22_002.log
```

Disable terminal colors through environment variables:

```bash
NO_COLOR=1
TERM=dumb
```

## Common Context Methods

Request information:

| Method | Description |
| --- | --- |
| `GetPath()` | Current request path, normalized |
| `GetRequestMethod()` | Raw request method |
| `GetMethod()` | Matched route method |
| `GetClientIP()` | IP chain, with `X-Forwarded-For` parsed first |
| `GetOriginalRequest()` | Original `*http.Request` |
| `GetOriginalResponseWriter()` | Original `http.ResponseWriter` |

Parameters and models:

| Method | Description |
| --- | --- |
| `GetParam(key)` | Get a single path parameter |
| `GetParams()` | Get all path parameters |
| `GetQuery(key, typ ...StarType)` | Get a single Query value, with optional type conversion |
| `GetQueries(typMap ...map[string]StarType)` | Get all Query values |
| `GetQueryModel()` | Get the bound Query DTO |
| `GetBody(key)` | Get a Body field |
| `GetBodyAll()` | Get the parsed Body map |
| `GetBodyModel()` | Get the bound Body DTO |

Request rewriting:

| Method | Description |
| --- | --- |
| `SetQueries(map[string]string)` | Rewrite Query parameters |
| `SetBody(string)` | Rewrite the request body and reset the Body parsing cache |

Response control:

| Method | Description |
| --- | --- |
| `SetStatusCode(code)` | Write the HTTP status code; only takes effect once |
| `GetStatusCode()` | Get the current HTTP status code, defaulting to 200 |
| `SetHeader(key, value)` | Set a response header |
| `AddHeader(key, value)` | Append a response header |
| `RemoveHeader(key)` | Remove a response header |
| `GetResponseHeader(key)` | Get a response header |
| `GetResponseHeaders()` | Get all response headers |
| `Json(status, data)` | Write JSON |
| `Html(status, tmpl, data...)` | Write HTML with LRU template caching |
| `ResponseSuccess(response)` | Write a 200 JSON response |
| `ResponseError(code, err...)` | Write an error response |

Cookie:

| Method | Description |
| --- | --- |
| `GetCookie(key)` | Read a Cookie |
| `GetCookies()` | Read all Cookies |
| `SetCookie(key, value, maxAge)` | Set a Cookie |
| `DeleteCookie(key)` | Delete a Cookie |

Context data and extensions:

| Method | Description |
| --- | --- |
| `AddContext(key, value)` | Write request-scoped context data |
| `GetContext(key)` | Read context data, supports `a.b` and `items[0].id` |
| `DelContext(key)` | Delete context data |
| `GetMeta(key)` | Read route metadata, supports nested paths |
| `IsWebSocket()` | Check whether the request is a WebSocket handshake |
| `GetWebSocket()` | Get the WebSocket connection |

## Global API

| API | Description |
| --- | --- |
| `New(bind string, useDefaultMiddleware ...bool)` | Initialize the Star instance |
| `Run()` | Start the HTTP server |
| `Use(component)` | Register routes, middleware, or guards |
| `EnableDebug()` | Enable debug mode |
| `EnableLogSave(config ...Logger)` | Enable log persistence |
| `ConfigureCors(config CorsConfig)` | Register CORS middleware |

Supported component types for `Use()`:

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

## Utilities

| Function | Description |
| --- | --- |
| `Now()` | Current time |
| `NowFormat(format)` | Current time formatted with the given format |
| `FormatTime(t, format)` | Format a time value |
| `ParseDateTime(s)` | Parse `2006-01-02 15:04:05` |
| `ParseTimestamp(s)` | Parse a second or millisecond timestamp |
| `VerifyTimestamp(s)` | Validate a timestamp string |
| `GenerateUUID()` | Generate a UUID v4 |
| `VerifyUUID(s)` | Validate a UUID |
| `GetValueByPath(obj, path)` | Read a value from a map, struct, or slice by path |

## Using Star From Another Project

The current module name is `star`. To reference it from another local project, add a `replace` directive to your `go.mod`:

```go
module your-app

go 1.26.1

require star v0.0.1

replace star => ../star
```

Then import it in code:

```go
import "star"
```

## Project Structure

```text
.
├── app.go          # Application initialization, startup, and global config
├── router.go       # Route definitions, nested route flattening, Meta merging
├── handler.go      # HTTP adapter, route matching, DTO binding, WebSocket/static/SPA wrappers
├── ctx.go          # Request context, parameter reading, response writing
├── middleware.go   # Middleware, CORS, rate limiting, Recover, access logs
├── log.go          # Log output and persistence
├── template.go     # Default page and error page templates
├── utils.go        # UUID, path value lookup, stack helpers
├── date.go         # Time utilities
└── demo            # Example application
```

## License

MIT
