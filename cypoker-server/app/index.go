package app

import (
	"server/internal/helper"
	// 在这里导入应用
	_ "server/app/game"
	_ "server/app/telegram"
)

func init() {
	helper.RegisterMiddleware(
	// 在这里注册全局中间件
	)
}
