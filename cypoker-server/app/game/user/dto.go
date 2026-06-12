package user

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"server/internal/utils"
	"star"
	"strings"
)

// RegisterDTO 注册DTO
type RegisterDTO struct {
	UserId    string `json:"user_id"`
	Nickname  string `json:"nickname"`
	AvatarUrl string `json:"avatar_url"`
}

// Validate 验证注册DTO
func (d *RegisterDTO) Validate(ctx *star.Context) error {
	if strings.TrimSpace(d.UserId) == "" {
		ctx.ResponseError(http.StatusBadRequest)
		return nil
	}
	if strings.TrimSpace(d.Nickname) == "" {
		nickname, err := utils.RandomString(6)
		if err != nil {
			d.Nickname = "Guest"
		} else {
			d.Nickname = "Guest_" + nickname
		}
	}
	if strings.TrimSpace(d.AvatarUrl) == "" {
		seed, _ := utils.RandomString(7)
		d.AvatarUrl = fmt.Sprintf("https://api.dicebear.com/9.x/toon-head/svg?flip=true&randomizeIds=true&beard[]&beardProbability=0&hairColor=2c1b18,724133&skinColor=f1c3a5&backgroundColor=b6e3f4&seed=%s", seed)
	}
	return nil
}

// UpdateUserLevelDTO 更新用户等级DTO
type UpdateUserLevelDTO struct {
	Experience int `json:"experience"`
}

// Validate 验证更新用户等级DTO
func (d *UpdateUserLevelDTO) Validate(ctx *star.Context) error {
	if d.Experience < 0 {
		return errors.New("EXPERIENCE_INVALID")
	}
	return nil
}

// UpdateUserWalletDTO 更新用户钱包DTO
type UpdateUserWalletDTO struct {
	Amount float64 `json:"amount"`
}

type TelegramLoginDTO struct {
	InitData string `json:"init_data"`
}

func (d *TelegramLoginDTO) Validate(ctx *star.Context) error {
	d.InitData = strings.TrimSpace(d.InitData)
	if d.InitData == "" {
		ctx.ResponseError(http.StatusBadRequest)
		return nil
	}
	parts := strings.Split(d.InitData, "&")
	userRaw := ""
	for _, p := range parts {
		if strings.HasPrefix(p, "user=") {
			userRaw = strings.TrimPrefix(p, "user=")
			break
		}
	}
	if userRaw == "" {
		ctx.ResponseError(http.StatusBadRequest)
		return nil
	}
	unescaped, err := url.QueryUnescape(userRaw)
	if err != nil {
		ctx.ResponseError(http.StatusBadRequest)
		return nil
	}
	var tmp map[string]any
	if err := json.Unmarshal([]byte(unescaped), &tmp); err != nil {
		ctx.ResponseError(http.StatusBadRequest)
		return nil
	}
	return nil
}
