package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

type harness struct {
	t      *testing.T
	app    *App
	server *httptest.Server
	path   string
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	path := filepath.Join(t.TempDir(), "farm.json")
	s, err := openStore("", path)
	if err != nil {
		t.Fatal(err)
	}
	app, err := newApp(s, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(app.routes())
	t.Cleanup(func() { server.Close(); app.shutdown(); s.close() })
	return &harness{t, app, server, path}
}
func (h *harness) client() *http.Client {
	jar, _ := cookiejar.New(nil)
	return &http.Client{Jar: jar, Timeout: 10 * time.Second}
}
func (h *harness) request(c *http.Client, method, path string, body any, status int, out any) {
	h.t.Helper()
	var b io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		b = bytes.NewReader(data)
	}
	req, _ := http.NewRequest(method, h.server.URL+path, b)
	req.Header.Set("Content-Type", "application/json")
	res, err := c.Do(req)
	if err != nil {
		h.t.Fatal(err)
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(res.Body)
	if res.StatusCode != status {
		h.t.Fatalf("%s %s status %d want %d: %s", method, path, res.StatusCode, status, data)
	}
	if out != nil {
		if err = json.Unmarshal(data, out); err != nil {
			h.t.Fatalf("decode %s: %v", data, err)
		}
	}
}
func (h *harness) signup(c *http.Client, name string) User {
	var out struct {
		User User `json:"user"`
	}
	h.request(c, "POST", "/api/auth/register", map[string]string{"username": name, "password": "test-password"}, 200, &out)
	return out.User
}

type detail struct {
	Room  Room      `json:"room"`
	State FarmState `json:"state"`
}

func TestAccountsPermissionsAtomicHarvestAndPersistence(t *testing.T) {
	h := newHarness(t)
	alice, bob := h.client(), h.client()
	h.signup(alice, "Alice")
	h.signup(bob, "小农夫")
	h.request(bob, "POST", "/api/auth/register", map[string]string{"username": "ALICE", "password": "password"}, 409, nil)
	h.request(bob, "POST", "/api/auth/login", map[string]string{"username": "Alice", "password": "incorrect"}, 401, nil)
	var room detail
	h.request(alice, "POST", "/api/rooms", map[string]string{"name": "棉花糖牧场"}, 201, &room)
	base := "/api/rooms/" + room.Room.ID
	h.request(bob, "GET", base, nil, 403, nil)
	h.request(bob, "POST", base+"/actions", Action{Type: "build", Facility: "shelter"}, 403, nil)
	h.request(bob, "POST", "/api/rooms/join", map[string]string{"code": strings.ToLower(room.Room.Code)}, 200, nil)
	// Introduce care through the same API as the UI before testing an atomic shear.
	h.request(alice, "POST", base+"/actions", Action{Type: "build", Facility: "shelter"}, 200, &room)
	h.request(alice, "POST", base+"/actions", Action{Type: "adopt"}, 200, &room)
	h.request(alice, "POST", base+"/actions", Action{Type: "pet", SheepID: room.State.Sheep[0].ID}, 200, &room)
	h.request(alice, "POST", base+"/actions", Action{Type: "feed", SheepID: room.State.Sheep[0].ID}, 200, &room)
	// Two players cannot shear the same wool twice.
	var wg sync.WaitGroup
	statuses := make(chan int, 2)
	for _, c := range []*http.Client{alice, bob} {
		wg.Add(1)
		go func(c *http.Client) {
			defer wg.Done()
			b, _ := json.Marshal(Action{Type: "shear", SheepID: room.State.Sheep[0].ID})
			res, err := c.Post(h.server.URL+base+"/actions", "application/json", bytes.NewReader(b))
			if err != nil {
				statuses <- 0
				return
			}
			defer res.Body.Close()
			_, _ = io.Copy(io.Discard, res.Body)
			statuses <- res.StatusCode
		}(c)
	}
	wg.Wait()
	close(statuses)
	sum := 0
	for status := range statuses {
		sum += status
	}
	if sum != 600 {
		t.Fatalf("two shear statuses sum = %d; want 200 + 400", sum)
	}
	h.request(alice, "POST", base+"/actions", map[string]any{"type": "buy", "itemId": "feed", "quantity": 1, "coins": 1000000}, 400, nil)
	h.request(alice, "GET", base, nil, 200, &room)
	if room.State.Inventory["wool_cloud"] != 3 {
		t.Fatalf("duplicate wool: %+v", room.State.Inventory)
	}
	// Reopening the durable store preserves room membership, sessions and harvest.
	reopened, err := openStore("", h.path)
	if err != nil {
		t.Fatal(err)
	}
	records, err := reopened.loadRooms(context.Background())
	if err != nil || len(records) != 1 || records[0].State.Inventory["wool_cloud"] != 3 || len(records[0].Members) != 2 {
		t.Fatalf("persistent state incorrect: %v %+v", err, records)
	}
	if a, err := reopened.findAccount(context.Background(), "alice"); err != nil || a.PasswordHash == "test-password" || a.PasswordHash == "" {
		t.Fatal("password was not persisted as a hash")
	}
	cookieURL, _ := http.NewRequest("GET", h.server.URL, nil)
	for _, cookie := range alice.Jar.Cookies(cookieURL.URL) {
		if cookie.Name == "flock_session" {
			if u, err := reopened.sessionUser(context.Background(), tokenHash(cookie.Value)); err != nil || u.Username != "Alice" {
				t.Fatalf("session did not survive reopening the store: %v", err)
			}
		}
	}
	h.request(alice, "POST", "/api/auth/logout", map[string]any{}, 200, nil)
	h.request(alice, "GET", base, nil, 401, nil)
	h.request(alice, "POST", "/api/auth/login", map[string]string{"username": "alice", "password": "test-password"}, 200, nil)
	h.request(alice, "GET", base, nil, 200, nil)
}
func TestFailedSaveDoesNotDeductCoins(t *testing.T) {
	h := newHarness(t)
	c := h.client()
	h.signup(c, "Farmer")
	var room detail
	h.request(c, "POST", "/api/rooms", map[string]string{"name": "小农场"}, 201, &room)
	base := "/api/rooms/" + room.Room.ID + "/actions"
	h.request(c, "POST", base, Action{Type: "build", Facility: "shelter"}, 200, &room)
	h.request(c, "POST", base, Action{Type: "adopt"}, 200, &room)
	h.request(c, "POST", base, Action{Type: "pet", SheepID: room.State.Sheep[0].ID}, 200, &room)
	blocked := filepath.Join(t.TempDir(), "not-a-directory")
	if err := os.WriteFile(blocked, []byte("x"), 0600); err != nil {
		t.Fatal(err)
	}
	h.app.store.path = filepath.Join(blocked, "farm.json")
	h.request(c, "POST", "/api/rooms/"+room.Room.ID+"/actions", Action{Type: "buy", ItemID: "feed", Quantity: 5}, 500, nil)
	var after detail
	h.request(c, "GET", "/api/rooms/"+room.Room.ID, nil, 200, &after)
	if after.State.Coins != room.State.Coins || after.State.Inventory["feed"] != room.State.Inventory["feed"] {
		t.Fatal("failed durable save charged the player")
	}
	h.app.store.path = h.path
}
func TestWebsocketCooperationAndOrigin(t *testing.T) {
	h := newHarness(t)
	alice, bob := h.client(), h.client()
	h.signup(alice, "Alice")
	h.signup(bob, "Bobby")
	var room detail
	h.request(alice, "POST", "/api/rooms", map[string]string{"name": "共享农场"}, 201, &room)
	h.request(bob, "POST", "/api/rooms/join", map[string]string{"code": room.Room.Code}, 200, nil)
	wsURL := "ws" + strings.TrimPrefix(h.server.URL, "http") + "/api/rooms/" + room.Room.ID + "/ws"
	connect := func(c *http.Client) *websocket.Conn {
		t.Helper()
		req, _ := http.NewRequest("GET", h.server.URL, nil)
		headers := http.Header{}
		for _, cookie := range c.Jar.Cookies(req.URL) {
			headers.Add("Cookie", cookie.String())
		}
		headers.Set("Origin", h.server.URL)
		ws, _, err := websocket.DefaultDialer.Dial(wsURL, headers)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { ws.Close() })
		return ws
	}
	wa, wb := connect(alice), connect(bob)
	if err := wb.WriteJSON(map[string]any{"type": "chat", "text": "你好呀！"}); err != nil {
		t.Fatal(err)
	}
	waitType := func(ws *websocket.Conn, kind string) map[string]any {
		t.Helper()
		_ = ws.SetReadDeadline(time.Now().Add(3 * time.Second))
		for i := 0; i < 12; i++ {
			var msg map[string]any
			if err := ws.ReadJSON(&msg); err != nil {
				t.Fatal(err)
			}
			if msg["type"] == kind {
				return msg
			}
		}
		t.Fatalf("no %s message", kind)
		return nil
	}
	chat := waitType(wa, "chat")
	if chat["username"] != "Bobby" || chat["text"] != "你好呀！" {
		t.Fatalf("wrong chat: %+v", chat)
	}
	jumpAt := func() int64 {
		t.Helper()
		msg := waitType(wa, "presence")
		for _, item := range msg["players"].([]any) {
			p := item.(map[string]any)
			if p["username"] == "Bobby" {
				if at, ok := p["jumpAt"].(float64); ok {
					return int64(at)
				}
			}
		}
		t.Fatal("jump was not broadcast to the other player")
		return 0
	}
	move := map[string]any{"type": "move", "position": Vec2{1, 7}, "facing": 0, "jump": true, "jumpAt": int64(9999999999999)}
	if err := wb.WriteJSON(move); err != nil {
		t.Fatal(err)
	}
	firstJump := jumpAt()
	if firstJump > nowMS() || nowMS()-firstJump > 1000 {
		t.Fatal("server trusted a client jump timestamp")
	}
	time.Sleep(60 * time.Millisecond)
	if err := wb.WriteJSON(move); err != nil {
		t.Fatal(err)
	}
	if jumpAt() != firstJump {
		t.Fatal("jump cooldown was bypassed")
	}
	if err := wb.WriteJSON(map[string]any{"type": "whistle", "position": Vec2{999, 999}, "at": int64(9999999999999)}); err != nil {
		t.Fatal(err)
	}
	whistle := waitType(wa, "whistle")
	anchor := whistle["position"].(map[string]any)
	if anchor["x"].(float64) != 1 || anchor["z"].(float64) != 7 || int64(whistle["at"].(float64)) > nowMS() {
		t.Fatal("whistle did not use the server-known position and timestamp")
	}
	h.request(alice, "POST", "/api/rooms/"+room.Room.ID+"/actions", Action{Type: "build", Facility: "shelter"}, 200, nil)
	// Bob sees the same authoritative change through a state broadcast.
	for i := 0; i < 5; i++ {
		msg := waitType(wb, "state")
		state := msg["state"].(map[string]any)
		if int(state["version"].(float64)) > room.State.Version {
			break
		}
		if i == 4 {
			t.Fatal("no changed state broadcast")
		}
	}
	req, _ := http.NewRequest("POST", h.server.URL+"/api/rooms", strings.NewReader(`{"name":"bad"}`))
	req.Header.Set("Origin", "https://unrelated.example")
	res, err := alice.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 403 {
		t.Fatal("cross-origin write accepted")
	}
	if _, res, err := websocket.DefaultDialer.Dial(wsURL, http.Header{"Origin": []string{"https://unrelated.example"}}); err == nil || res.StatusCode != 401 {
		t.Fatal("unauthenticated websocket accepted")
	}
}
func TestStaticFilesAndHealth(t *testing.T) {
	h := newHarness(t)
	if err := os.WriteFile(filepath.Join(h.app.staticDir, "index.html"), []byte("<h1>Farm</h1>"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(h.app.staticDir, "assets"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(h.app.staticDir, "assets", "app.js"), []byte("test"), 0644); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"/", "/farm/123", "/assets/app.js", "/api/health"} {
		res, err := h.client().Get(h.server.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != 200 {
			t.Fatal(fmt.Sprintf("%s = %d", path, res.StatusCode))
		}
	}
}

func TestGrazingUsesAuthenticatedWebsocketPosition(t *testing.T) {
	h := newHarness(t)
	c := h.client()
	h.signup(c, "牧羊人")
	var room detail
	h.request(c, "POST", "/api/rooms", map[string]string{"name": "放牧测试"}, 201, &room)
	rr := h.app.rooms[room.Room.ID]
	rr.mu.Lock()
	rr.record.State = establishedFarm(nowMS())
	rr.record.State.Progression.Step = 10
	rr.mu.Unlock()
	base := "/api/rooms/" + room.Room.ID
	h.request(c, "POST", base+"/actions", Action{Type: "startGraze"}, 400, nil)
	h.request(c, "POST", base+"/actions", map[string]any{"type": "startGraze", "actorPosition": worldMap.Home.ReturnPoint}, 400, nil)
	req, _ := http.NewRequest("GET", h.server.URL, nil)
	headers := http.Header{"Origin": []string{h.server.URL}}
	for _, cookie := range c.Jar.Cookies(req.URL) {
		headers.Add("Cookie", cookie.String())
	}
	ws, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(h.server.URL, "http")+base+"/ws", headers)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.Close()
	// The default spawn is outside the gathering point's radius.
	h.request(c, "POST", base+"/actions", Action{Type: "startGraze"}, 400, nil)
	if err := ws.WriteJSON(map[string]any{"type": "move", "position": worldMap.Home.ReturnPoint, "facing": 0}); err != nil {
		t.Fatal(err)
	}
	_ = ws.SetReadDeadline(time.Now().Add(3 * time.Second))
	for {
		var msg struct {
			Type    string   `json:"type"`
			Players []Player `json:"players"`
		}
		if err := ws.ReadJSON(&msg); err != nil {
			t.Fatal(err)
		}
		if msg.Type == "presence" && len(msg.Players) == 1 && msg.Players[0].Position == worldMap.Home.ReturnPoint {
			break
		}
	}
	h.request(c, "POST", base+"/actions", Action{Type: "startGraze"}, 200, &room)
	if !room.State.Grazing.Active || room.State.Progression.Step != 11 {
		t.Fatal("server-known gathering position did not start the trip")
	}
	h.request(c, "POST", base+"/actions", Action{Type: "waterFlock"}, 400, nil)
	h.request(c, "POST", base+"/actions", map[string]any{"type": "finishGraze", "grazeSeconds": 20, "watered": true}, 400, nil)
}
