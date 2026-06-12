package bootstrap

import (
	// 导入内置守卫
	_ "server/internal/guard"
	// 导入内置中间件
	_ "server/internal/middleware"
	// 导入内置应用
	_ "server/internal/system"
	_ "server/internal/system/admin"
	_ "server/internal/system/black-list"
	_ "server/internal/system/menu"

	// 导入 app 包
	_ "server/app" // 应用
)
