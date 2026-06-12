package helper

import (
	"os"
	"star"
	"strings"
	"sync"
)

var (
	namespaces     = map[string]*star.Route{} // Namespaces 命名空间
	namespaceMutex = sync.RWMutex{}           // namespaceMutex 命名空间锁
)

// Namespace 命名空间
type Namespace struct {
	Name       string            // 命名空间名称
	Method     star.Method       // 支持的请求方式，默认 ANY
	Middleware []star.Middleware // 中间件
	Meta       map[string]any    // 元数据
}


// 注册命名空间
//
// Example:
//    helper.RegisterNamespaces(
//        &helper.Namespace{
//            // 命名空间名称
//            Name: "namespace-name",
//
//            // 可以指定命名空间内所有路由的请求方式，默认 star.ANY
//            // 注意：子路由中的 Method 会覆盖父路由的 Method
//            Method: star.POST,
//
//            // 命名空间所使用的中间件
//            Middleware: []star.Middleware{
//                star.RateLimitMiddleware(10, time.Minute), // 内置限流中间件，10次/分钟
//            },
//
//            // 命名空间所使用的元数据
//            // 在路由处理器中，可以通过 ctx.GetMeta() 获取这些元数据
//            // 注意：子路由 Meta 中同名 key 会覆盖父路由的 Meta
//            Meta: map[string]any{
//                "requireAuth":  false, // 是否需要认证
//                "encrypt":      false, // 请求数据和响应数据是否需要加解密
//            },
//        },
//    )
func RegisterNamespaces(namespace ...*Namespace) {
	namespaceMutex.Lock()
	defer namespaceMutex.Unlock()

	for _, n := range namespace {
		name := ""

		// 检查命名空间名称是否为空
		if n != nil && strings.TrimSpace(n.Name) != "" {
			name = normalizeRoutePrefix(n.Name)
		}

		if name == "" {
			star.Log.E("NAMESPACE", "Namespace name is empty")
			os.Exit(1)
		}

		if _, ok := namespaces[name]; ok {
			star.Log.E("NAMESPACE", "Namespace already registered: %s", n.Name)
			os.Exit(1)
		}

		namespaces[name] = &star.Route{
			Path:       name,
			Method:     n.Method,
			Middleware: n.Middleware,
			Meta:       n.Meta,
			Children:   []star.Route{},
		}

		star.Log.I("NAMESPACE", "Namespace registered: %s", n.Name)
	}
}

// RegisterRoutesToNamespace 注册路由到命名空间
func RegisterRoutesToNamespace(namespace string, routes ...star.Route) {
	namespaceMutex.Lock()
	defer namespaceMutex.Unlock()

	if strings.TrimSpace(namespace) == "" {
		star.Log.E("NAMESPACE", "Namespace name is empty")
		os.Exit(1)
	}

	namespace = normalizeRoutePrefix(namespace)

	if _, ok := namespaces[namespace]; !ok {
		star.Log.E("NAMESPACE", "Namespace not found: %s", namespace)
		os.Exit(1)
	}

	namespaces[namespace].Children = append(namespaces[namespace].Children, routes...)
}

// InitNamespaces 初始化命名空间
func InitNamespaces() {
	for _, namespace := range namespaces {
		RegisterRoutes(*namespace)
	}
}
