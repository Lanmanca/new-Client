package bootstrap

import (
	"fmt"
	"server/internal/helper"
	"star"
)

// 启动服务
func Start() {
	// 初始化配置
	helper.InitConfig()

	config := helper.Config

	// 调试模式
	if config.Debug {
		star.EnableDebug()
	}

	// 日志配置
	if config.Log.Save {
		star.EnableLogSave(config.Log)
	}

	// 初始化数据源
	helper.InitDataSource()
	helper.InitRedis()
	helper.InitModel()
	helper.InitNamespaces()

	// 初始化 Star 实例
	star.New(fmt.Sprintf(":%d", config.Port))

	// 跨域配置
	star.ConfigureCors(config.Cors)

	// 注册中间件
	star.Use(helper.Middleware)

	// 注册路由
	star.Use(helper.Routes)

	// 注册前置守卫
	star.Use(helper.BeforeGuard)

	// 注册后置守卫
	star.Use(helper.AfterGuard)

	// 启动服务
	star.Run()
}
