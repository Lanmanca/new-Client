package helper

import (
	"star"
	"sync"
)

var (
	Middleware      = []star.Middleware{} // Middleware 中间件
	middlewareMutex = sync.RWMutex{}      // middlewareMutex 中间件锁
)

// Register 注册中间件
func RegisterMiddleware(middleware ...star.Middleware) {
	middlewareMutex.Lock()
	defer middlewareMutex.Unlock()
	Middleware = append(Middleware, middleware...)
}
