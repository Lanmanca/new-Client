package user

import (
	"server/internal/helper"
	"star"
)

func Router() star.Route {
	c := NewController()

	return star.Route{
		Path: "/user",
		Children: []star.Route{
			{Path: "/register", Method: star.POST, Body: &RegisterDTO{}, Handler: c.Register},
			{Path: "/login", Method: star.POST, Handler: c.Login},
			{Path: "/login_telegram", Method: star.POST, Body: &TelegramLoginDTO{}, Handler: c.LoginTelegram},
			{Path: "/info", Method: star.GET, Handler: c.GetUserInfo},
			{Path: "/list", Method: star.POST, Body: &helper.PageParam{}, Handler: c.GetUserList},

			{Path: "/update_status", Method: star.POST, Handler: c.UpdateUserStatus},
			{Path: "/update_is_vip", Method: star.POST, Handler: c.UpdateUserIsVip},
			{Path: "/update_level", Method: star.POST, Body: &UpdateUserLevelDTO{}, Handler: c.UpdateUserLevel},
			{Path: "/update_wallet", Method: star.POST, Body: &UpdateUserWalletDTO{}, Handler: c.UpdateUserWallet},
		},
	}
}
