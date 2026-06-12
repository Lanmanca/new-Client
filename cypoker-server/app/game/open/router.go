package open

import (
	"star"
)

func Router() star.Route {
	c := NewController()

	return star.Route{
		Path: "/open",
		Meta: map[string]any{"encrypt": false},
		Children: []star.Route{
			{Path: "/app_version", Handler: c.GetAppVersion},
		},
	}
}
