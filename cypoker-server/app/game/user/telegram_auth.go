package user

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"server/internal/helper"
)

type telegramWebAppUser struct {
	ID           int64  `json:"id"`
	Username     string `json:"username"`
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name"`
	PhotoURL     string `json:"photo_url"`
	LanguageCode string `json:"language_code"`
}

func telegramBotToken() string {
	if v := strings.TrimSpace(os.Getenv("TELEGRAM_BOT_TOKEN")); v != "" {
		return v
	}
	if raw := helper.Get("telegram.bot_token"); raw != nil {
		if s, ok := raw.(string); ok {
			return strings.TrimSpace(s)
		}
	}
	return ""
}

func telegramInitDataMaxAgeSec() int64 {
	// 默认 10 分钟
	maxAge := int64(600)
	if v := strings.TrimSpace(os.Getenv("TELEGRAM_INIT_DATA_MAX_AGE_SEC")); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n >= 0 {
			maxAge = n
		}
	}
	if raw := helper.Get("telegram.init_data_max_age_sec"); raw != nil {
		switch vv := raw.(type) {
		case int:
			if vv >= 0 {
				maxAge = int64(vv)
			}
		case int64:
			if vv >= 0 {
				maxAge = vv
			}
		case float64:
			if vv >= 0 {
				maxAge = int64(vv)
			}
		case string:
			if n, err := strconv.ParseInt(strings.TrimSpace(vv), 10, 64); err == nil && n >= 0 {
				maxAge = n
			}
		}
	}
	return maxAge
}

func verifyTelegramInitData(initData string, maxAgeSec int64) (*telegramWebAppUser, error) {
	token := telegramBotToken()
	if token == "" {
		return nil, errors.New("TELEGRAM_BOT_TOKEN_NOT_SET")
	}
	values, err := url.ParseQuery(initData)
	if err != nil {
		return nil, errors.New("TELEGRAM_INIT_DATA_INVALID")
	}
	hash := values.Get("hash")
	if strings.TrimSpace(hash) == "" {
		return nil, errors.New("TELEGRAM_INIT_DATA_NO_HASH")
	}
	authDateRaw := values.Get("auth_date")
	authDate, err := strconv.ParseInt(authDateRaw, 10, 64)
	if err != nil || authDate <= 0 {
		return nil, errors.New("TELEGRAM_INIT_DATA_NO_AUTH_DATE")
	}
	now := time.Now().Unix()
	if maxAgeSec > 0 && now-authDate > maxAgeSec {
		return nil, errors.New("TELEGRAM_INIT_DATA_EXPIRED")
	}

	keys := make([]string, 0, len(values))
	for k := range values {
		if k == "hash" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	lines := make([]string, 0, len(keys))
	for _, k := range keys {
		lines = append(lines, fmt.Sprintf("%s=%s", k, values.Get(k)))
	}
	dataCheckString := strings.Join(lines, "\n")

	secretH := hmac.New(sha256.New, []byte("WebAppData"))
	secretH.Write([]byte(token))
	secret := secretH.Sum(nil)
	checkH := hmac.New(sha256.New, secret)
	checkH.Write([]byte(dataCheckString))
	computed := hex.EncodeToString(checkH.Sum(nil))
	if !hmac.Equal([]byte(computed), []byte(hash)) {
		return nil, errors.New("TELEGRAM_INIT_DATA_BAD_HASH")
	}

	userRaw := values.Get("user")
	if strings.TrimSpace(userRaw) == "" {
		return nil, errors.New("TELEGRAM_INIT_DATA_NO_USER")
	}
	var u telegramWebAppUser
	if err := json.Unmarshal([]byte(userRaw), &u); err != nil {
		return nil, errors.New("TELEGRAM_INIT_DATA_BAD_USER")
	}
	if u.ID <= 0 {
		return nil, errors.New("TELEGRAM_INIT_DATA_BAD_USER_ID")
	}
	return &u, nil
}
