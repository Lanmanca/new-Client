package helper

import (
	"path"
	"star"
	"strings"
	"sync"
)

var (
	Routes           = []star.Route{}            // Routes 路由
	routeMutex       = sync.RWMutex{}            // routeMutex 路由锁
	BeforeGuard      = []star.BeforeRouteGuard{} // BeforeGuard 前置守卫
	beforeGuardMutex = sync.RWMutex{}            // beforeGuardMutex 前置守卫锁
	AfterGuard       = []star.AfterRouteGuard{}  // AfterGuard 后置守卫
	afterGuardMutex  = sync.RWMutex{}            // afterGuardMutex 后置守卫锁
)

// normalizeRoutePrefix 去掉首尾空白，保证单前导斜杠，并合并连续斜杠
func normalizeRoutePrefix(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return "/"
	}
	return path.Clean("/" + strings.TrimPrefix(s, "/"))
}

// RegisterRoutes 注册路由
func RegisterRoutes(routes ...star.Route) {
	routeMutex.Lock()
	defer routeMutex.Unlock()

	Routes = append(Routes, routes...)
}

// RegisterBeforeGuard 注册前置守卫
func RegisterBeforeGuard(guards ...star.BeforeRouteGuard) {
	beforeGuardMutex.Lock()
	defer beforeGuardMutex.Unlock()
	BeforeGuard = append(BeforeGuard, guards...)
}

// RegisterAfterGuard 注册后置守卫
func RegisterAfterGuard(guards ...star.AfterRouteGuard) {
	afterGuardMutex.Lock()
	defer afterGuardMutex.Unlock()
	AfterGuard = append(AfterGuard, guards...)
}
