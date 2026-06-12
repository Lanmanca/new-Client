package game

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type WSManager struct {
	repo *Repository
	hub  *RoomHub
}

func NewWSManager(repo *Repository) *WSManager {
	m := &WSManager{
		repo: repo,
		hub: &RoomHub{
			roomConns:    map[string]map[*websocket.Conn]struct{}{},
			connKeys:     map[*websocket.Conn]string{},
			roomUserConn: map[string]map[string]*websocket.Conn{},
			connUsers:    map[*websocket.Conn]string{},
		},
	}
	go m.runRoomTimers()
	return m
}

func (m *WSManager) runRoomTimers() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		changed := m.repo.ProcessRoomTimers()
		for roomID, state := range changed {
			m.hub.broadcastRoomState(roomID, state)
		}
	}
}

// CloseRoom 关闭某房间全部 WebSocket（房主解散房间时调用）。
func (m *WSManager) CloseRoom(roomID string) {
	m.hub.closeRoom(roomID)
}

type RoomHub struct {
	mu           sync.RWMutex
	roomConns    map[string]map[*websocket.Conn]struct{}
	connKeys     map[*websocket.Conn]string
	roomUserConn map[string]map[string]*websocket.Conn
	connUsers    map[*websocket.Conn]string
}

func (h *RoomHub) register(roomID, userID string, conn *websocket.Conn, deviceID string) {
	if strings.TrimSpace(userID) == "" {
		fmt.Printf("[game.ws] reject register: empty user_id room=%s\n", roomID)
		_ = conn.Close()
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.roomConns[roomID]; !ok {
		h.roomConns[roomID] = map[*websocket.Conn]struct{}{}
	}
	if _, ok := h.roomUserConn[roomID]; !ok {
		h.roomUserConn[roomID] = map[string]*websocket.Conn{}
	}
	// 同房间同用户仅保留一个连接，防止重复订阅与重复广播。
	if oldConn, ok := h.roomUserConn[roomID][userID]; ok && oldConn != conn {
		delete(h.roomConns[roomID], oldConn)
		delete(h.connKeys, oldConn)
		_ = oldConn.Close()
	}
	h.roomConns[roomID][conn] = struct{}{}
	h.connKeys[conn] = deviceID
	h.connUsers[conn] = userID
	h.roomUserConn[roomID][userID] = conn
	fmt.Printf("[game.ws] register room=%s user=%s conns=%d\n", roomID, userID, len(h.roomConns[roomID]))
}

// IsActiveUserConn 判断该连接是否仍是该用户在房间内的“当前”连接（已被新连接替换时返回 false）。
// 用于断开 defer：避免同账号重连后旧连接关闭误触发 leave。
func (h *RoomHub) IsActiveUserConn(roomID, userID string, conn *websocket.Conn) bool {
	if conn == nil || strings.TrimSpace(roomID) == "" || strings.TrimSpace(userID) == "" {
		return false
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	userConns, ok := h.roomUserConn[roomID]
	if !ok {
		return false
	}
	current, ok := userConns[userID]
	return ok && current == conn
}

func (h *RoomHub) unregister(roomID, userID string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if conns, ok := h.roomConns[roomID]; ok {
		delete(conns, conn)
		if len(conns) == 0 {
			delete(h.roomConns, roomID)
		}
	}
	if userConns, ok := h.roomUserConn[roomID]; ok {
		if current, ok2 := userConns[userID]; ok2 && current == conn {
			delete(userConns, userID)
		}
		if len(userConns) == 0 {
			delete(h.roomUserConn, roomID)
		}
	}
	delete(h.connKeys, conn)
	delete(h.connUsers, conn)
	fmt.Printf("[game.ws] unregister room=%s user=%s\n", roomID, userID)
}

func (h *RoomHub) closeRoom(roomID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.roomConns[roomID] {
		delete(h.connKeys, c)
		delete(h.connUsers, c)
		_ = c.Close()
	}
	delete(h.roomConns, roomID)
	delete(h.roomUserConn, roomID)
}

// sendRoomStateToConn WebSocket 刚注册时向该连接补发一份当前房态（与广播同格式），避免客户端再用 HTTP 轮询补态。
func (h *RoomHub) sendRoomStateToConn(conn *websocket.Conn, deviceID, viewerUserID string, roomState *RoomStateResp) {
	if conn == nil || roomState == nil {
		return
	}
	masked := h.maskRoomStateForUser(roomState, viewerUserID)
	payload, _ := json.Marshal(map[string]any{
		"id":        "",
		"type":      "event",
		"event":     "room_state_sync",
		"user_id":   "",
		"device_id": "",
		"timestamp": time.Now().UnixMilli(),
		"status":    true,
		"message":   "ROOM_STATE_SYNC",
		"extra": map[string]any{
			"show": false,
		},
		"data": map[string]any{
			"room_state": masked,
		},
	})
	_ = deviceID
	_ = conn.WriteMessage(websocket.TextMessage, payload)
}

func (h *RoomHub) broadcastRoomState(roomID string, roomState *RoomStateResp) {
	if roomState == nil {
		return
	}
	for _, event := range roomState.Events {
		h.broadcastRoomEvent(roomID, event)
	}

	h.mu.RLock()
	conns := make([]*websocket.Conn, 0, len(h.roomConns[roomID]))
	connKeys := make(map[*websocket.Conn]string, len(h.roomConns[roomID]))
	connUsers := make(map[*websocket.Conn]string, len(h.roomConns[roomID]))
	for c := range h.roomConns[roomID] {
		conns = append(conns, c)
		connKeys[c] = h.connKeys[c]
		connUsers[c] = h.connUsers[c]
	}
	h.mu.RUnlock()

	for _, c := range conns {
		_ = connKeys[c]
		userID := connUsers[c]
		masked := h.maskRoomStateForUser(roomState, userID)
		payload, _ := json.Marshal(map[string]any{
			"id":        "",
			"type":      "event",
			"event":     "room_state_sync",
			"user_id":   "",
			"device_id": "",
			"timestamp": time.Now().UnixMilli(),
			"status":    true,
			"message":   "ROOM_STATE_SYNC",
			"extra": map[string]any{
				"show": false,
			},
			"data": map[string]any{
				"room_state": masked,
			},
		})
		_ = c.WriteMessage(websocket.TextMessage, payload)
	}
}

func (h *RoomHub) broadcastRoomEvent(roomID string, event RoomEvent) {
	h.mu.RLock()
	conns := make([]*websocket.Conn, 0, len(h.roomConns[roomID]))
	connKeys := make(map[*websocket.Conn]string, len(h.roomConns[roomID]))
	for c := range h.roomConns[roomID] {
		conns = append(conns, c)
		connKeys[c] = h.connKeys[c]
	}
	h.mu.RUnlock()

	payload, _ := json.Marshal(event)
	for _, c := range conns {
		_ = connKeys[c]
		_ = c.WriteMessage(websocket.TextMessage, payload)
	}
}

// sendEventToUser 向指定房间内指定用户定向推送一个事件（如 recover）。
func (h *RoomHub) sendEventToUser(roomID, userID string, event RoomEvent) {
	h.mu.RLock()
	conn, ok := h.roomUserConn[roomID][userID]
	h.mu.RUnlock()
	if !ok || conn == nil {
		return
	}
	payload, _ := json.Marshal(map[string]any{
		"type":      "event",
		"event":     event.Event,
		"timestamp": time.Now().UnixMilli(),
		"status":    true,
		"message":   "WS_EVENT_RECEIVED",
		"data":      event.Data,
	})
	_ = conn.WriteMessage(websocket.TextMessage, payload)
}

func (h *RoomHub) maskRoomStateForUser(roomState *RoomStateResp, userID string) *RoomStateResp {
	if roomState == nil {
		return nil
	}
	copyState := *roomState
	copyState.Players = make([]PlayerSeat, len(roomState.Players))
	for i, p := range roomState.Players {
		cp := p
		if len(p.Cards) > 0 {
			cp.Cards = append([]int(nil), p.Cards...)
		}
		copyState.Players[i] = cp
	}
	maskRoomStateHoleCards(&copyState, userID)
	return &copyState
}
