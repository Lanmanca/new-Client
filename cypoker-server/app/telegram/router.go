package telegram

import (
	"io"
	"net/http"
	"net/url"
	"os"
	"server/internal/helper"
	"star"
	"strings"
	"time"
	"fmt"
)

type webhookUpdate struct {
	UpdateID int64            `json:"update_id"`
	Message  *telegramMessage `json:"message,omitempty"`
}

type telegramMessage struct {
	MessageID int64        `json:"message_id"`
	Date      int64        `json:"date"`
	Text      string       `json:"text"`
	Chat      telegramChat `json:"chat"`
	From      telegramUser `json:"from"`
}

type telegramChat struct {
	ID    int64  `json:"id"`
	Type  string `json:"type"`
	Title string `json:"title"`
}

type telegramUser struct {
	ID        int64  `json:"id"`
	Username  string `json:"username"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

func webhookSecretOK(ctx *star.Context) bool {
	secret := strings.TrimSpace(os.Getenv("TELEGRAM_WEBHOOK_SECRET"))
	if secret == "" {
		return true
	}
	return strings.TrimSpace(ctx.GetRequestHeader("X-Telegram-Bot-Api-Secret-Token")) == secret
}

func webhookHandler(ctx *star.Context) *star.Response {
	if !webhookSecretOK(ctx) {
		star.Log.W("TELEGRAM", "Reject webhook: bad secret token")
		return helper.FailWithShow("TELEGRAM_WEBHOOK_UNAUTHORIZED")
	}
	in, _ := ctx.GetBodyModel().(*webhookUpdate)
	if in == nil {
		star.Log.W("TELEGRAM", "Webhook body parse failed")
		return helper.Success("TELEGRAM_WEBHOOK_OK", map[string]any{"ok": true})
	}
	if in.Message == nil {
		star.Log.I("TELEGRAM", "Update received: update_id=%d (non-message)", in.UpdateID)
		return helper.Success("TELEGRAM_WEBHOOK_OK", map[string]any{"ok": true})
	}

	msg := in.Message
	text := strings.TrimSpace(msg.Text)
	command := ""
	if strings.HasPrefix(text, "/") {
		if idx := strings.Index(text, " "); idx > 0 {
			command = text[:idx]
		} else {
			command = text
		}
	}

	star.Log.I(
		"TELEGRAM",
		"Update message: update_id=%d chat_id=%d chat_type=%s from_id=%d username=%s text=%q command=%s",
		in.UpdateID,
		msg.Chat.ID,
		msg.Chat.Type,
		msg.From.ID,
		msg.From.Username,
		text,
		command,
	)

	return helper.Success("TELEGRAM_WEBHOOK_OK", map[string]any{
		"ok":        true,
		"update_id": in.UpdateID,
		"chat_id":   msg.Chat.ID,
		"from_id":   msg.From.ID,
		"text":      text,
		"command":   command,
	})
}

func isAllowedTelegramHost(host string) bool {
	h := strings.ToLower(strings.TrimSpace(host))
	if h == "" {
		return false
	}
	return h == "t.me" || strings.HasSuffix(h, ".t.me") || h == "telegram.org" || strings.HasSuffix(h, ".telegram.org")
}

func init() {
	helper.RegisterNamespaces(
		&helper.Namespace{Name: "telegram-api", Meta: map[string]any{"encrypt": false, "requireAuth": false}},
	)

	helper.RegisterRoutesToNamespace(
		"telegram-api",
		star.Route{Method: star.POST, Body: &webhookUpdate{}, Handler: webhookHandler},
	)

	helper.RegisterRoutes(
		star.Route{Path: "/telegram-image", Handler: func(ctx *star.Context) *star.Response {
			rawURL := strings.TrimSpace(ctx.GetQuery("url").(string))
			if rawURL == "" {
				rawURL = strings.TrimSpace(ctx.GetQuery("path").(string))
			}
			if rawURL == "" {
				fmt.Println("rawURL1:", rawURL)
				ctx.ResponseError(http.StatusBadRequest)
				return nil
			}

			if strings.HasPrefix(rawURL, "//") {
				rawURL = "https:" + rawURL
			}


			targetURL, err := url.Parse(rawURL)
			if err != nil {
				fmt.Println("rawURL2:", rawURL, err)
				ctx.ResponseError(http.StatusBadRequest, err)
				return nil
			}

			if targetURL.Scheme == "" && targetURL.Host == "" {
				targetURL, err = url.Parse("https://t.me" + strings.TrimSpace(targetURL.String()))
				if err != nil {
					fmt.Println("rawURL3:", rawURL, err)
					ctx.ResponseError(http.StatusBadRequest, err)
					return nil
				}
			}

			if !strings.EqualFold(targetURL.Scheme, "http") && !strings.EqualFold(targetURL.Scheme, "https") {
				fmt.Println("rawURL4:", rawURL)
				ctx.ResponseError(http.StatusBadRequest)
				return nil
			}
			if !isAllowedTelegramHost(targetURL.Hostname()) {
				fmt.Println("rawURL5:", rawURL)
				ctx.ResponseError(http.StatusBadRequest)
				return nil
			}

			req, err := http.NewRequest(http.MethodGet, targetURL.String(), nil)
			if err != nil {
				fmt.Println("rawURL6:", rawURL, err)
				ctx.ResponseError(http.StatusBadRequest, err)
				return nil
			}
			if ua := strings.TrimSpace(ctx.GetRequestHeader("User-Agent")); ua != "" {
				req.Header.Set("User-Agent", ua)
			}

			resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
			if err != nil {
				fmt.Println("err?????????:", err)
				ctx.ResponseError(http.StatusBadGateway, err)
				return nil
			}
			defer resp.Body.Close()

			w := ctx.GetOriginalResponseWriter()
			ctx.SetHeader("Access-Control-Allow-Origin", "*")
			if ct := strings.TrimSpace(resp.Header.Get("Content-Type")); ct != "" {
				ctx.SetHeader("Content-Type", ct)
			}
			if cc := strings.TrimSpace(resp.Header.Get("Cache-Control")); cc != "" {
				ctx.SetHeader("Cache-Control", cc)
			}
			if etag := strings.TrimSpace(resp.Header.Get("ETag")); etag != "" {
				ctx.SetHeader("ETag", etag)
			}
			if lm := strings.TrimSpace(resp.Header.Get("Last-Modified")); lm != "" {
				ctx.SetHeader("Last-Modified", lm)
			}
			ctx.SetStatusCode(resp.StatusCode)
			if _, err := io.Copy(w, resp.Body); err != nil {
				star.Log.W("TELEGRAM", "telegram image proxy copy body failed: %v", err)
			}

			return nil
		}, Meta: map[string]any{"encrypt": false, "requireAuth": false}},
	)
}
