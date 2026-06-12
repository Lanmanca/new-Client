package middleware

import (
	"net/http"
	"strings"
	"time"

	"server/internal/helper"
	"star"
)

// timestampMaxSkew 请求 Timestamp 与服务器时间的允许偏差
const timestampMaxSkew = 5 * time.Minute

// verifyMiddleware 验证中间件
func verifyMiddleware() star.Middleware {
	return func(next star.Handler) star.Handler {
		return func(ctx *star.Context) *star.Response {
			// 如果是 WebSocket 请求，则不进行验证
			if !ctx.IsWebSocket() && !strings.HasPrefix(ctx.GetPath(), "/telegram-api") && !strings.HasPrefix(ctx.GetPath(), "/telegram-image") {
				// 验证 Device-ID
				deviceID := ctx.GetRequestHeader("X-Device-ID")
				if !star.VerifyUUID(deviceID) {
					star.Log.W("VERIFY", "Device-ID is not set, request id: %s", ctx.RequestID)
					ctx.ResponseError(http.StatusBadRequest)
					return nil
				}

				// 验证时戳
				timestamp := ctx.GetRequestHeader("X-Timestamp")
				if !star.VerifyTimestamp(timestamp) {
					star.Log.W("VERIFY", "Timestamp is not set, request id: %s", ctx.RequestID)
					ctx.ResponseError(http.StatusBadRequest)
					return nil
				}

				// 验证时戳与服务器时间是否在允许偏差内
				ts, err := star.ParseTimestamp(timestamp)
				if err != nil {
					star.Log.W("VERIFY", "Timestamp parse error: %v, request id: %s", err, ctx.RequestID)
					ctx.ResponseError(http.StatusBadRequest)
					return nil
				}
				skew := star.Now().Sub(ts)
				if skew < 0 {
					skew = -skew
				}
				if skew > timestampMaxSkew {
					star.Log.W("VERIFY", "Timestamp skew too large (%v > %v), request id: %s", skew, timestampMaxSkew, ctx.RequestID)
					ctx.ResponseError(http.StatusBadRequest)
					return nil
				}
			}

			return next(ctx)
		}
	}
}

func init() {
	helper.RegisterMiddleware(verifyMiddleware())
}
