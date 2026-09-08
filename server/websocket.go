package main

import (
	"encoding/json"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/gorilla/websocket"
)

type Client struct {
	conn   *websocket.Conn
	user   User
	player Player
	send   chan []byte
	done   chan struct{}
	once   sync.Once
}

func (c *Client) close() { c.once.Do(func() { close(c.done); _ = c.conn.Close() }) }
func (rr *RuntimeRoom) broadcast(v any) {
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	for c := range rr.clients {
		select {
		case c.send <- b:
		default:
			c.close()
		}
	}
}
func (rr *RuntimeRoom) players() []Player {
	out := []Player{}
	seen := map[string]bool{}
	for c := range rr.clients {
		if !seen[c.user.ID] {
			out = append(out, c.player)
			seen[c.user.ID] = true
		}
	}
	return out
}

var upgrader = websocket.Upgrader{ReadBufferSize: 1024, WriteBufferSize: 4096, CheckOrigin: sameOrigin}

func (a *App) websocket(w http.ResponseWriter, r *http.Request) {
	u, ok := a.requireUser(w, r)
	if !ok {
		return
	}
	rr := a.roomFor(w, r, u)
	if rr == nil {
		return
	}
	rr.mu.Lock()
	if rr.deleted {
		rr.mu.Unlock()
		jsonError(w, 404, "这座牧场已经被主人删除了")
		return
	}
	if len(rr.clients) >= 24 {
		rr.mu.Unlock()
		jsonError(w, 429, "农场当前连接较多，稍后再来吧")
		return
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		rr.mu.Unlock()
		return
	}
	colors := []string{"#de9479", "#89b7a1", "#aca1cc", "#d4b575", "#87aec8"}
	c := &Client{conn: conn, user: u, player: Player{ID: u.ID, Username: u.Username, Avatar: u.Avatar, Position: Vec2{1, 7}, Color: colors[len(rr.clients)%len(colors)]}, send: make(chan []byte, 64), done: make(chan struct{})}
	rr.tick(nowMS())
	rr.clients[c] = true
	rr.broadcast(map[string]any{"type": "presence", "players": rr.players()})
	b, _ := json.Marshal(map[string]any{"type": "state", "state": rr.record.State, "serverTime": nowMS()})
	c.send <- b
	rr.mu.Unlock()
	go c.writePump()
	c.readPump(a, rr)
	rr.mu.Lock()
	rr.tick(nowMS())
	delete(rr.clients, c)
	rr.broadcast(map[string]any{"type": "presence", "players": rr.players()})
	rr.mu.Unlock()
	c.close()
}
func (c *Client) writePump() {
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()
	defer c.close()
	for {
		select {
		case <-c.done:
			return
		case b, ok := <-c.send:
			if !ok {
				return
			}
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if c.conn.WriteMessage(websocket.TextMessage, b) != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if c.conn.WriteMessage(websocket.PingMessage, nil) != nil {
				return
			}
		}
	}
}
func (c *Client) readPump(a *App, rr *RuntimeRoom) {
	c.conn.SetReadLimit(2048)
	_ = c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error { return c.conn.SetReadDeadline(time.Now().Add(60 * time.Second)) })
	lastMove := time.Now().Add(-time.Second)
	lastChat := time.Time{}
	lastWhistle := time.Time{}
	for {
		_, b, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		var msg struct {
			Type     string  `json:"type"`
			Position Vec2    `json:"position"`
			Facing   float64 `json:"facing"`
			Jump     bool    `json:"jump"`
			Text     string  `json:"text"`
		}
		if json.Unmarshal(b, &msg) != nil {
			continue
		}
		switch msg.Type {
		case "move":
			now := time.Now()
			dt := now.Sub(lastMove).Seconds()
			if dt < .04 {
				continue
			}
			if math.IsNaN(msg.Position.X) || math.IsInf(msg.Position.X, 0) || math.IsNaN(msg.Position.Z) || math.IsInf(msg.Position.Z, 0) || math.IsNaN(msg.Facing) || math.IsInf(msg.Facing, 0) {
				continue
			}
			rr.mu.Lock()
			dx := msg.Position.X - c.player.Position.X
			dz := msg.Position.Z - c.player.Position.Z
			distance := math.Hypot(dx, dz)
			limit := math.Min(dt, 2)*14 + 1
			if distance > limit {
				msg.Position.X = c.player.Position.X + dx/distance*limit
				msg.Position.Z = c.player.Position.Z + dz/distance*limit
			}
			rr.tick(now.UnixMilli())
			c.player.Position = allowedPosition(&rr.record.State, msg.Position, c.player.Position)
			c.player.Facing = msg.Facing
			if msg.Jump && now.UnixMilli()-c.player.JumpAt >= 650 {
				c.player.JumpAt = now.UnixMilli()
			}
			rr.broadcast(map[string]any{"type": "presence", "players": rr.players()})
			rr.mu.Unlock()
			lastMove = now
		case "chat":
			text := strings.TrimSpace(msg.Text)
			if utf8.RuneCountInString(text) < 1 || utf8.RuneCountInString(text) > 180 || time.Since(lastChat) < time.Second {
				continue
			}
			lastChat = time.Now()
			rr.mu.Lock()
			rr.broadcast(map[string]any{"type": "chat", "userId": c.user.ID, "username": c.user.Username, "text": text, "at": nowMS()})
			rr.mu.Unlock()
		case "whistle":
			if time.Since(lastWhistle) < 3*time.Second {
				continue
			}
			lastWhistle = time.Now()
			rr.mu.Lock()
			rr.broadcast(map[string]any{"type": "whistle", "position": c.player.Position, "at": lastWhistle.UnixMilli()})
			rr.mu.Unlock()
		}
	}
}
