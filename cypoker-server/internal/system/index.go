package system

import (
	"server/internal/helper"
	"star"
	"time"
)

func init() {
	// 注册系统 API 命名空间
	helper.RegisterNamespaces(
		&helper.Namespace{
			Name:   "system-api",
			Method: star.POST,
			Middleware: []star.Middleware{
				star.RateLimitMiddleware(10, time.Minute),
			},
			Meta: map[string]any{
				"requireAuth": true,  // 需要认证
				"encrypt":     false, // 调试期关闭加解密
			},
		},
	)
}
