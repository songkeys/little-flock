package main

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func (h *harness) connect(c *http.Client, roomID string) *websocket.Conn {
	h.t.Helper()
	req, _ := http.NewRequest("GET", h.server.URL, nil)
	headers := http.Header{"Origin": []string{h.server.URL}}
	for _, cookie := range c.Jar.Cookies(req.URL) {
		headers.Add("Cookie", cookie.String())
	}
	ws, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(h.server.URL, "http")+"/api/rooms/"+roomID+"/ws", headers)
	if err != nil {
		h.t.Fatal(err)
	}
	h.t.Cleanup(func() { ws.Close() })
	return ws
}

func TestProfileValidationLiveAppearanceAndPersistence(t *testing.T) {
	h := newHarness(t)
	alice, bob := h.client(), h.client()
	owner := h.signup(alice, "Alice")
	h.signup(bob, "Bobby")
	if owner.Avatar != (AvatarAppearance{}) {
		t.Fatal("new account does not use the default appearance")
	}
	var room detail
	h.request(alice, "POST", "/api/rooms", map[string]string{"name": "衣橱农场"}, 201, &room)
	h.request(bob, "POST", "/api/rooms/join", map[string]string{"code": room.Room.Code}, 200, nil)
	h.connect(alice, room.Room.ID)
	observer := h.connect(bob, room.Room.ID)
	avatar := AvatarAppearance{Skin: 4, Hair: 3, Outfit: 7, Hat: 2}
	h.request(h.client(), "PATCH", "/api/auth/profile", map[string]any{"avatar": avatar}, 401, nil)
	for _, invalid := range []any{
		AvatarAppearance{Skin: -1}, AvatarAppearance{Skin: 6}, AvatarAppearance{Hair: 6},
		AvatarAppearance{Outfit: 8}, AvatarAppearance{Hat: 4}, nil,
		map[string]any{"skin": 1.5}, map[string]any{"hat": 0, "coins": 100},
	} {
		h.request(alice, "PATCH", "/api/auth/profile", map[string]any{"avatar": invalid}, 400, nil)
	}
	var profile struct {
		User User `json:"user"`
	}
	h.request(alice, "PATCH", "/api/auth/profile", map[string]any{"avatar": avatar}, 200, &profile)
	if profile.User.ID != owner.ID || profile.User.Avatar != avatar {
		t.Fatal("profile response does not contain the saved owner appearance")
	}
	_ = observer.SetReadDeadline(time.Now().Add(3 * time.Second))
	for {
		var msg struct {
			Type    string   `json:"type"`
			Players []Player `json:"players"`
		}
		if err := observer.ReadJSON(&msg); err != nil {
			t.Fatal("appearance was not broadcast to another member:", err)
		}
		found := false
		for _, p := range msg.Players {
			if p.ID == owner.ID && p.Avatar == avatar {
				found = true
			}
		}
		if found {
			break
		}
	}
	h.request(alice, "GET", "/api/auth/me", nil, 200, &profile)
	if profile.User.Avatar != avatar {
		t.Fatal("session did not return the saved appearance")
	}
	reopened, err := openStore("", h.path)
	if err != nil {
		t.Fatal(err)
	}
	account, err := reopened.findAccount(context.Background(), owner.Username)
	if err != nil || account.Avatar != avatar {
		t.Fatal("appearance did not survive a fresh store load:", err)
	}
	h.request(alice, "POST", "/api/auth/logout", map[string]any{}, 200, nil)
	h.request(alice, "POST", "/api/auth/login", map[string]string{"username": owner.Username, "password": "test-password"}, 200, &profile)
	if profile.User.Avatar != avatar {
		t.Fatal("login response lost the saved appearance")
	}
}

func TestOwnerDeletesFarmAndEjectsMembers(t *testing.T) {
	h := newHarness(t)
	alice, bob := h.client(), h.client()
	h.signup(alice, "Alice")
	h.signup(bob, "Bobby")
	var removed, retained detail
	h.request(alice, "POST", "/api/rooms", map[string]string{"name": "要删除的世界"}, 201, &removed)
	h.request(bob, "POST", "/api/rooms/join", map[string]string{"code": removed.Room.Code}, 200, nil)
	h.request(bob, "POST", "/api/rooms", map[string]string{"name": "另一片天地"}, 201, &retained)
	h.request(alice, "POST", "/api/rooms/join", map[string]string{"code": retained.Room.Code}, 200, nil)
	base := "/api/rooms/" + removed.Room.ID
	h.request(h.client(), "DELETE", base, nil, 401, nil)
	h.request(bob, "DELETE", base, nil, 403, nil)
	wa, wb := h.connect(alice, removed.Room.ID), h.connect(bob, removed.Room.ID)
	var result struct {
		DeletedRoomID string `json:"deletedRoomId"`
		Rooms         []Room `json:"rooms"`
	}
	h.request(alice, "DELETE", base, nil, 200, &result)
	if result.DeletedRoomID != removed.Room.ID || len(result.Rooms) != 1 || result.Rooms[0].ID != retained.Room.ID {
		t.Fatal("delete response did not retain the owner's other joined farm")
	}
	for _, ws := range []*websocket.Conn{wa, wb} {
		_ = ws.SetReadDeadline(time.Now().Add(3 * time.Second))
		deleted := false
		for {
			var msg struct {
				Type   string `json:"type"`
				RoomID string `json:"roomId"`
			}
			if err := ws.ReadJSON(&msg); err != nil {
				if _, closed := err.(*websocket.CloseError); !deleted || !closed {
					t.Fatal("member socket did not receive deletion before closing:", err)
				}
				break
			}
			if msg.Type == "roomDeleted" && msg.RoomID == removed.Room.ID {
				deleted = true
			}
		}
	}
	h.request(alice, "GET", base, nil, 404, nil)
	h.request(alice, "DELETE", base, nil, 404, nil)
	h.request(bob, "POST", base+"/actions", Action{Type: "build", Facility: "shelter"}, 404, nil)
	h.request(bob, "POST", "/api/rooms/join", map[string]string{"code": removed.Room.Code}, 404, nil)
	h.request(bob, "GET", "/api/rooms", nil, 200, &result)
	if len(result.Rooms) != 1 || result.Rooms[0].ID != retained.Room.ID {
		t.Fatal("deleted farm remained in a member's room list")
	}
	reopened, err := openStore("", h.path)
	if err != nil {
		t.Fatal(err)
	}
	rooms, err := reopened.loadRooms(context.Background())
	if err != nil || len(rooms) != 1 || rooms[0].Room.ID != retained.Room.ID {
		t.Fatal("deleted farm survived reopening the durable store:", err)
	}
}

func TestProfileAndDeletionRollbackOnFailedSave(t *testing.T) {
	h := newHarness(t)
	c := h.client()
	h.signup(c, "Farmer")
	var room detail
	h.request(c, "POST", "/api/rooms", map[string]string{"name": "留下来的家"}, 201, &room)
	blocked := filepath.Join(t.TempDir(), "not-a-directory")
	if err := os.WriteFile(blocked, []byte("x"), 0600); err != nil {
		t.Fatal(err)
	}
	h.app.store.path = filepath.Join(blocked, "farm.json")
	h.request(c, "DELETE", "/api/rooms/"+room.Room.ID, nil, 500, nil)
	h.request(c, "PATCH", "/api/auth/profile", map[string]any{"avatar": AvatarAppearance{Outfit: 7}}, 500, nil)
	var profile struct {
		User User `json:"user"`
	}
	h.request(c, "GET", "/api/auth/me", nil, 200, &profile)
	if profile.User.Avatar != (AvatarAppearance{}) {
		t.Fatal("failed profile save changed the account appearance")
	}
	h.request(c, "GET", "/api/rooms/"+room.Room.ID, nil, 200, nil)
	h.app.store.path = h.path
	rooms, err := h.app.store.loadRooms(context.Background())
	if err != nil || len(rooms) != 1 || rooms[0].Room.ID != room.Room.ID {
		t.Fatal("failed deletion removed the durable room")
	}
}
