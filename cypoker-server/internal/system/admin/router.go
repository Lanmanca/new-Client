package admin

import (
	"server/internal/helper"
	"star"
)

func init() {
	c := NewController()

	// 注册路由到系统 API 命名空间
	helper.RegisterRoutesToNamespace("system-api",
		star.Route{
			Path: "/auth",
			Children: []star.Route{
				{
					Path:    "/login",
					Handler: c.Login,
					Body:    &LoginDTO{},
					Meta:    map[string]any{"requireAuth": false},
				},
				{Path: "/logout", Handler: c.Logout},
				{Path: "/change-password", Handler: c.ChangePassword},
				{Path: "/update-profile", Handler: c.UpdateProfile},
				{Path: "/ping", Method: star.GET, Handler: c.Ping},
			},
		},
		star.Route{
			Path: "/admin",
			Children: []star.Route{
				{Path: "/list", Handler: c.GetAdminList},
				{Path: "/create", Handler: c.CreateAdmin},
				{Path: "/update", Handler: c.UpdateAdmin},
				{Path: "/delete", Handler: c.DeleteAdmin},
			},
		},
	)
}
