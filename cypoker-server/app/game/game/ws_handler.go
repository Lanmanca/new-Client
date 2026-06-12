package game

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"star"
)

type wsRequestEnvelope struct {
	ID       string         `json:"id"`
	Type     string         `json:"type"`
	UserID   string         `json:"user_id"`
	DeviceID string         `json:"device_id"`
	Event    string         `json:"event"`
	Data     map[string]any `json:"data"`
}

// Handle 处理 WebSocket 连接；提供：PING/PONG、消息解包、ACK 回包、房态广播。
func (m *WSManager) Handle(ctx *star.Context) *star.Response {
	conn := ctx.GetWebSocket()
	if conn == nil {
		return nil
	}
	defer conn.Close()

	deviceID := fmt.Sprintf("%v", ctx.GetQuery("device_id"))
	roomID := fmt.Sprintf("%v", ctx.GetQuery("room_id"))
	userID := fmt.Sprintf("%v", ctx.GetQuery("user_id"))
	m.hub.register(roomID, userID, conn, deviceID)
	// 连接建立后立即下发当前房态：房态真源在 WS 推送链路，避免客户端依赖「每次 onopen 再打 HTTP」补态。
	if strings.TrimSpace(roomID) != "" && strings.TrimSpace(userID) != "" {
		if rs, err := m.repo.GetRoomState(roomID); err == nil && rs != nil {
			m.hub.sendRoomStateToConn(conn, deviceID, userID, rs)
		}
	}
	// leaveSentByClient 标记该连接是否已显式处理过 "leave" 事件。
	// 若客户端主动发送了 leave 事件并得到处理，后续 WS 断连时 defer 不应再触发第二次 leave，
	// 否则会导致 ResumeStatus 被覆盖（如从 "ready" 退化为 "busy"），并产生重复广播。
	leaveSentByClient := false
	defer func() {
		// 连接断开（如刷新页面、意外断网）视为临时离开，进入可重连状态并广播给同房间玩家。
		// 两种情况跳过 defer leave：
		//   1. 该连接已被同用户新 WebSocket 替换（register 关闭了旧连接）
		//   2. 客户端已显式发送过 leave 事件且服务端已处理
		if !leaveSentByClient && roomID != "" && userID != "" && m.hub.IsActiveUserConn(roomID, userID, conn) {
			if roomState, err := m.repo.ApplyPlayerEvent(roomID, userID, "leave", nil); err == nil {
				m.hub.broadcastRoomState(roomID, roomState)
			}
		}
		m.hub.unregister(roomID, userID, conn)
	}()

	for {
		msgType, payload, err := conn.ReadMessage()
		if err != nil {
			return nil
		}

		if msgType == 1 && string(payload) == "PING" {
			_ = conn.WriteMessage(1, []byte("PONG"))
			continue
		}

		plain := string(payload)

		var req wsRequestEnvelope
		_ = json.Unmarshal([]byte(plain), &req)

		resp := map[string]any{
			"id":        req.ID,
			"type":      req.Type,
			"user_id":   req.UserID,
			"device_id": req.DeviceID,
			"timestamp": time.Now().UnixMilli(),
			"status":    true,
			"message":   "WS_EVENT_RECEIVED",
			"extra": map[string]any{
				"show": false,
			},
		}

		if strings.TrimSpace(req.ID) == "" {
			resp["type"] = "notice"
			resp["message"] = "WS_MESSAGE_INVALID"
			resp["status"] = false
			resp["extra"] = map[string]any{"show": true}
		}

		// 处理房间事件并广播最新房态
		if req.Type == "event" && req.Event != "" {
			requestUserID := req.UserID
			if requestUserID == "" {
				requestUserID = userID
			}
			roomState, err := m.repo.ApplyPlayerEvent(roomID, requestUserID, req.Event, req.Data)
			if err == nil {
				m.hub.broadcastRoomState(roomID, roomState)
				// 客户端显式发送了 leave 且处理成功，标记以防断连 defer 重复触发
				if req.Event == "leave" {
					leaveSentByClient = true
				}
			} else {
				resp["status"] = false
				resp["message"] = err.Error()
				resp["extra"] = map[string]any{"show": true}
			}
		}

		buf, _ := json.Marshal(resp)
		_ = conn.WriteMessage(1, buf)
	}
}
