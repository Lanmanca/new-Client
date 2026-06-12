package game

import "strings"

// normUserID 用于比较/映射：去除首尾空白并转小写，避免 WS 查询参数与房内 user_id 大小写不一致导致
// mask 误把本人当他人、或 syncAccountBalancesFromDB 对不上 game_users 行。
func normUserID(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func sameUserID(a, b string) bool {
	return normUserID(a) == normUserID(b)
}
