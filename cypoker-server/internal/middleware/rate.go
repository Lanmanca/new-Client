package middleware

import (
	"server/internal/helper"
	"star"
)

// rateLimit 限流中间件
func rateLimitMiddleware() star.Middleware {
	return func(next star.Handler) star.Handler {
		return func(ctx *star.Context) *star.Response {
			return next(ctx)
		}
	}
}

func init() {
	helper.RegisterMiddleware(rateLimitMiddleware())
}
