package middleware

import (
	"fmt"
	"net/http"
	"server/internal/helper"
	"server/internal/utils"
	"star"
	"sync"
	"time"
)

const (
	REQUEST_LOCK_KEY      = "request:lock:%s"
	MAX_REQUEST_LOCK_TIME = 5 * time.Second
)

var requestSet sync.Map

// lockMiddleware 请求锁中间件
func lockMiddleware() star.Middleware {
	return func(next star.Handler) star.Handler {
		return func(ctx *star.Context) *star.Response {
			// WebSocket 是长连接，请求锁会在连接生命周期内一直占用，导致重连被误判为 429
			if ctx.IsWebSocket() {
				return next(ctx)
			}

			// 1. 生成唯一指纹
			ip := utils.ToString(ctx.GetClientIP())
			method := ctx.GetRequestMethod()
			path := ctx.GetPath()
			deviceId := ctx.GetRequestHeader("X-Device-ID")

			fingerprint := utils.MD5(fmt.Sprintf("%s:%s:%s:%s", ip, method, path, deviceId))
			key := fmt.Sprintf(REQUEST_LOCK_KEY, fingerprint)

			// 2. 尝试获取锁
			if _, loaded := requestSet.LoadOrStore(key, time.Now()); loaded {
				ctx.ResponseError(http.StatusTooManyRequests)
				return nil
			}

			// 3. 立即释放锁
			defer requestSet.Delete(key)

			// 4. 执行业务逻辑
			return next(ctx)
		}
	}
}

func init() {
	helper.RegisterMiddleware(lockMiddleware())
}
