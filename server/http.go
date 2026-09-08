package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

type RuntimeRoom struct {
	deleted     bool
	mu          sync.Mutex
	record      RoomRecord
	clients     map[*Client]bool
	lastPersist int64
}
type App struct {
	store      *Store
	mu         sync.RWMutex
	rooms      map[string]*RuntimeRoom
	limiter    limiter
	staticDir  string
	stop       chan struct{}
	tickerDone chan struct{}
}

func newApp(store *Store, staticDir string) (*App, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	records, err := store.loadRooms(ctx)
	if err != nil {
		return nil, err
	}
	a := &App{store: store, rooms: map[string]*RuntimeRoom{}, staticDir: staticDir, stop: make(chan struct{}), tickerDone: make(chan struct{})}
	for _, r := range records {
		r.State.UpdatedAt = nowMS()
		r.Room.OnlineCount = 0
		a.rooms[r.Room.ID] = &RuntimeRoom{record: r, clients: map[*Client]bool{}}
	}
	go a.runTicker()
	return a, nil
}
func (a *App) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		if a.store.db != nil {
			ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()
			if err := a.store.db.Ping(ctx); err != nil {
				jsonError(w, 503, "数据库连接暂时不可用")
				return
			}
		}
		writeJSON(w, 200, map[string]any{"ok": true, "service": "little-flock", "time": nowMS()})
	})
	mux.HandleFunc("/api/auth/{action}", a.auth)
	mux.HandleFunc("PATCH /api/auth/profile", a.updateProfile)
	mux.HandleFunc("GET /api/rooms", a.listRooms)
	mux.HandleFunc("POST /api/rooms", a.createRoom)
	mux.HandleFunc("POST /api/rooms/join", a.joinRoom)
	mux.HandleFunc("GET /api/rooms/{id}", a.getRoom)
	mux.HandleFunc("DELETE /api/rooms/{id}", a.deleteRoom)
	mux.HandleFunc("POST /api/rooms/{id}/actions", a.action)
	mux.HandleFunc("GET /api/rooms/{id}/ws", a.websocket)
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) { jsonError(w, 404, "没有找到这个入口") })
	mux.HandleFunc("/", a.static)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
			if r.Method != "GET" && !sameOrigin(r) {
				jsonError(w, 403, "请从农场页面进行操作")
				return
			}
			r.Body = http.MaxBytesReader(w, r.Body, 16*1024)
		}
		mux.ServeHTTP(w, r)
	})
}
func sameOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	return err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Host == r.Host
}
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("response write: %v", err)
	}
}
func jsonError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
func decodeJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		jsonError(w, 400, "提交的内容不完整，请重试")
		return false
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		jsonError(w, 400, "提交的内容格式不正确")
		return false
	}
	return true
}
func (a *App) internal(w http.ResponseWriter, err error) {
	log.Printf("request failed: %v", err)
	jsonError(w, 500, "保存暂时遇到问题，请稍后再试。你的操作还没有扣费")
}
func (a *App) requireUser(w http.ResponseWriter, r *http.Request) (User, bool) {
	u, err := a.currentUser(r)
	if err != nil {
		if errors.Is(err, errNotFound) || errors.Is(err, http.ErrNoCookie) {
			jsonError(w, 401, "请先登录，农场在等你回来")
		} else {
			a.internal(w, err)
		}
		return u, false
	}
	return u, true
}
func (a *App) roomFor(w http.ResponseWriter, r *http.Request, u User) *RuntimeRoom {
	a.mu.RLock()
	room := a.rooms[r.PathValue("id")]
	a.mu.RUnlock()
	if room == nil {
		jsonError(w, 404, "没有找到这座农场")
		return nil
	}
	room.mu.Lock()
	ok := room.record.Members[u.ID]
	room.mu.Unlock()
	if !ok {
		jsonError(w, 403, "先用邀请码加入这座农场吧")
		return nil
	}
	return room
}
func roomDetail(rr *RuntimeRoom) map[string]any {
	r := rr.record.Room
	r.MemberCount = len(rr.record.Members)
	r.OnlineCount = len(rr.players())
	return map[string]any{"room": r, "state": rr.record.State, "serverTime": nowMS()}
}
func (a *App) listRooms(w http.ResponseWriter, r *http.Request) {
	u, ok := a.requireUser(w, r)
	if !ok {
		return
	}
	writeJSON(w, 200, map[string]any{"rooms": a.userRooms(u.ID)})
}
func (a *App) userRooms(userID string) []Room {
	out := []Room{}
	a.mu.RLock()
	rooms := make([]*RuntimeRoom, 0, len(a.rooms))
	for _, rr := range a.rooms {
		rooms = append(rooms, rr)
	}
	a.mu.RUnlock()
	for _, rr := range rooms {
		rr.mu.Lock()
		if !rr.deleted && rr.record.Members[userID] {
			room := rr.record.Room
			room.MemberCount = len(rr.record.Members)
			room.OnlineCount = len(rr.players())
			out = append(out, room)
		}
		rr.mu.Unlock()
	}
	slices.SortFunc(out, func(x, y Room) int {
		if x.CreatedAt > y.CreatedAt {
			return -1
		}
		if x.CreatedAt < y.CreatedAt {
			return 1
		}
		return 0
	})
	return out
}
func (a *App) createRoom(w http.ResponseWriter, r *http.Request) {
	u, ok := a.requireUser(w, r)
	if !ok {
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	body.Name = strings.TrimSpace(body.Name)
	if utf8.RuneCountInString(body.Name) < 1 || utf8.RuneCountInString(body.Name) > 32 {
		jsonError(w, 400, "农场名字需要 1–32 个字")
		return
	}
	if !a.limiter.allow("create:"+u.ID, 5, time.Hour) {
		jsonError(w, 429, "今天先照顾好已有的农场吧，稍后再来创建")
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	count := 0
	codes := map[string]bool{}
	for _, rr := range a.rooms {
		if rr.record.Room.OwnerID == u.ID {
			count++
		}
		codes[rr.record.Room.Code] = true
	}
	if count >= 10 {
		jsonError(w, 400, "最多可以拥有 10 座农场")
		return
	}
	code := strings.ToUpper(newID()[:6])
	for codes[code] {
		code = strings.ToUpper(newID()[:6])
	}
	at := nowMS()
	record := RoomRecord{Room: Room{ID: newID(), Name: body.Name, Code: code, OwnerID: u.ID, MemberCount: 1, CreatedAt: at}, Members: map[string]bool{u.ID: true}, State: initialState(at)}
	if err := a.store.saveRoom(r.Context(), record); err != nil {
		a.internal(w, err)
		return
	}
	rr := &RuntimeRoom{record: record, clients: map[*Client]bool{}, lastPersist: at}
	a.rooms[record.Room.ID] = rr
	writeJSON(w, 201, roomDetail(rr))
}
func (a *App) joinRoom(w http.ResponseWriter, r *http.Request) {
	u, ok := a.requireUser(w, r)
	if !ok {
		return
	}
	var body struct {
		Code string `json:"code"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if !a.limiter.allow("join:"+u.ID, 30, 10*time.Minute) {
		jsonError(w, 429, "尝试有点频繁，确认邀请码后再来吧")
		return
	}
	code := strings.ToUpper(strings.TrimSpace(body.Code))
	a.mu.RLock()
	var room *RuntimeRoom
	for _, rr := range a.rooms {
		if rr.record.Room.Code == code {
			room = rr
			break
		}
	}
	a.mu.RUnlock()
	if room == nil {
		jsonError(w, 404, "邀请码不对哦，请再确认一下")
		return
	}
	room.mu.Lock()
	defer room.mu.Unlock()
	if room.deleted {
		jsonError(w, 404, "这座牧场已经被主人删除了")
		return
	}
	if !room.record.Members[u.ID] {
		if len(room.record.Members) >= 16 {
			jsonError(w, 400, "这座农场已经有 16 位伙伴啦")
			return
		}
		room.record.Members[u.ID] = true
		room.record.Room.MemberCount = len(room.record.Members)
		if err := a.store.saveRoom(r.Context(), room.record); err != nil {
			delete(room.record.Members, u.ID)
			room.record.Room.MemberCount = len(room.record.Members)
			a.internal(w, err)
			return
		}
	}
	writeJSON(w, 200, roomDetail(room))
}
func (a *App) getRoom(w http.ResponseWriter, r *http.Request) {
	u, ok := a.requireUser(w, r)
	if !ok {
		return
	}
	rr := a.roomFor(w, r, u)
	if rr == nil {
		return
	}
	rr.mu.Lock()
	defer rr.mu.Unlock()
	if rr.deleted {
		jsonError(w, 404, "这座牧场已经被主人删除了")
		return
	}
	rr.tick(nowMS())
	writeJSON(w, 200, roomDetail(rr))
}

func (a *App) deleteRoom(w http.ResponseWriter, r *http.Request) {
	u, ok := a.requireUser(w, r)
	if !ok {
		return
	}
	// Keep removal atomic with room lookup; a stale request/ticker must also
	// observe deleted under the room lock before it can write another snapshot.
	a.mu.Lock()
	rr := a.rooms[r.PathValue("id")]
	if rr == nil {
		a.mu.Unlock()
		jsonError(w, 404, "没有找到这座牧场")
		return
	}
	rr.mu.Lock()
	if rr.record.Room.OwnerID != u.ID {
		rr.mu.Unlock()
		a.mu.Unlock()
		jsonError(w, 403, "只有创建这座牧场的主人才能删除它")
		return
	}
	id := rr.record.Room.ID
	if err := a.store.deleteRoom(r.Context(), id); err != nil {
		rr.mu.Unlock()
		a.mu.Unlock()
		a.internal(w, err)
		return
	}
	rr.deleted = true
	delete(a.rooms, id)
	rr.broadcast(map[string]any{"type": "roomDeleted", "roomId": id})
	for c := range rr.clients {
		// The writer drains the deletion message, then closes the socket.
		delete(rr.clients, c)
		close(c.send)
	}
	rr.mu.Unlock()
	a.mu.Unlock()
	writeJSON(w, 200, map[string]any{"deletedRoomId": id, "rooms": a.userRooms(u.ID)})
}

func (a *App) action(w http.ResponseWriter, r *http.Request) {
	u, ok := a.requireUser(w, r)
	if !ok {
		return
	}
	rr := a.roomFor(w, r, u)
	if rr == nil {
		return
	}
	if !a.limiter.allow("action:"+u.ID, 120, 10*time.Second) {
		jsonError(w, 429, "操作太快啦，稍微慢一点点")
		return
	}
	var action Action
	if !decodeJSON(w, r, &action) {
		return
	}
	rr.mu.Lock()
	defer rr.mu.Unlock()
	if rr.deleted {
		jsonError(w, 404, "这座牧场已经被主人删除了")
		return
	}
	at := nowMS()
	rr.tick(at)
	action.actorID = u.ID
	action.actorPosition = rr.playerPosition(u.ID)
	if rr.record.State.Grazing.LeaderID != nil {
		action.leaderOnline = rr.playerPosition(*rr.record.State.Grazing.LeaderID) != nil
	}
	next := cloneState(rr.record.State)
	msg, err := applyAction(&next, action, at)
	if err != nil {
		jsonError(w, 400, err.Error())
		return
	}
	record := rr.record
	record.State = next
	if err = a.store.saveRoom(r.Context(), record); err != nil {
		a.internal(w, err)
		return
	}
	rr.record.State = next
	rr.lastPersist = at
	rr.broadcast(map[string]any{"type": "state", "state": next, "serverTime": at})
	rr.broadcast(map[string]any{"type": "event", "text": u.Username + " · " + msg, "at": at})
	writeJSON(w, 200, map[string]any{"state": next, "message": msg, "serverTime": at})
}
func (a *App) static(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" && r.Method != "HEAD" {
		http.Error(w, "Method not allowed", 405)
		return
	}
	clean := filepath.Clean("/" + r.URL.Path)
	path := filepath.Join(a.staticDir, clean)
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		if filepath.Ext(clean) != "" {
			http.NotFound(w, r)
			return
		}
		path = filepath.Join(a.staticDir, "index.html")
	}
	if strings.HasPrefix(clean, "/assets/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	}
	http.ServeFile(w, r, path)
}
func (a *App) runTicker() {
	defer close(a.tickerDone)
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-a.stop:
			return
		case <-ticker.C:
			a.mu.RLock()
			rooms := make([]*RuntimeRoom, 0, len(a.rooms))
			for _, rr := range a.rooms {
				rooms = append(rooms, rr)
			}
			a.mu.RUnlock()
			for _, rr := range rooms {
				rr.mu.Lock()
				if rr.deleted {
					rr.mu.Unlock()
					continue
				}
				at := nowMS()
				active := len(rr.clients) > 0
				rr.tick(at)
				if active {
					rr.broadcast(map[string]any{"type": "state", "state": rr.record.State, "serverTime": at})
					if at-rr.lastPersist >= 15000 {
						ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
						err := a.store.saveRoom(ctx, rr.record)
						cancel()
						if err != nil {
							log.Printf("periodic room save failed: %v", err)
						} else {
							rr.lastPersist = at
						}
					}
				}
				rr.mu.Unlock()
			}
		}
	}
}
func (a *App) shutdown() {
	close(a.stop)
	<-a.tickerDone
	a.mu.RLock()
	defer a.mu.RUnlock()
	for _, rr := range a.rooms {
		rr.mu.Lock()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		if err := a.store.saveRoom(ctx, rr.record); err != nil {
			log.Printf("shutdown save: %v", err)
		}
		cancel()
		for c := range rr.clients {
			c.close()
		}
		rr.mu.Unlock()
	}
}
