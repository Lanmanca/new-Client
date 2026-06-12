package guard

import (
	"net/http"
	"server/internal/helper"
	"star"
	"strings"
)

// Authorization 授权前置处理
func Authorization() star.BeforeRouteGuard {
	return func(ctx *star.Context) *star.Response {
		requireAuth := ctx.GetMeta("requireAuth")

		// 如果不需要认证，则直接返回
		if requireAuth == nil || !requireAuth.(bool) {
			return nil
		}

		// 认证逻辑
		userId := ctx.GetRequestHeader("X-User-Id")
		if strings.TrimSpace(userId) != "" {
			return nil
		}

		// 认证失败
		ctx.ResponseError(http.StatusUnauthorized)
		return nil
	}
}

func init() {
	helper.RegisterBeforeGuard(Authorization())
}
