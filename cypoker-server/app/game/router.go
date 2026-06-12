package game

import (
	"server/app/game/game"
	"server/app/game/open"
	"server/app/game/user"
	"server/internal/helper"
)

func init() {
	helper.RegisterNamespaces(
		&helper.Namespace{Name: "game-api", Meta: map[string]any{"encrypt": false}},
	)

	helper.RegisterRoutesToNamespace(
		"game-api",
		game.Router(),
		user.Router(),
		open.Router(),
	)
}
