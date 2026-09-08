package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
)

type rateBucket struct {
	Count int
	Reset time.Time
}
type limiter struct {
	mu      sync.Mutex
	buckets map[string]rateBucket
}

func (l *limiter) allow(key string, limit int, window time.Duration) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.buckets == nil {
		l.buckets = map[string]rateBucket{}
	}
	now := time.Now()
	if len(l.buckets) > 5000 {
		for k, v := range l.buckets {
			if now.After(v.Reset) {
				delete(l.buckets, k)
			}
		}
	}
	b := l.buckets[key]
	if now.After(b.Reset) {
		b = rateBucket{Reset: now.Add(window)}
	}
	b.Count++
	l.buckets[key] = b
	return b.Count <= limit
}
func tokenHash(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
func publicUser(a Account) User { return User{ID: a.ID, Username: a.Username, Avatar: a.Avatar} }
func remoteKey(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
func (a *App) currentUser(r *http.Request) (User, error) {
	c, err := r.Cookie("flock_session")
	if err != nil {
		return User{}, err
	}
	if len(c.Value) != 64 {
		return User{}, errNotFound
	}
	return a.store.sessionUser(r.Context(), tokenHash(c.Value))
}
func secureRequest(r *http.Request) bool {
	return r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}
func setSessionCookie(w http.ResponseWriter, r *http.Request, token string, maxAge int) {
	http.SetCookie(w, &http.Cookie{Name: "flock_session", Value: token, Path: "/", HttpOnly: true, Secure: secureRequest(r), SameSite: http.SameSiteLaxMode, MaxAge: maxAge})
}
func (a *App) auth(w http.ResponseWriter, r *http.Request) {
	endpoint := r.PathValue("action")
	if endpoint == "me" && r.Method == "GET" {
		u, err := a.currentUser(r)
		if err != nil {
			jsonError(w, 401, "请先登录，农场在等你回来")
			return
		}
		writeJSON(w, 200, map[string]any{"user": u})
		return
	}
	if r.Method != "POST" {
		jsonError(w, 405, "操作方式不正确")
		return
	}
	if endpoint == "logout" {
		if c, err := r.Cookie("flock_session"); err == nil {
			if err = a.store.deleteSession(r.Context(), tokenHash(c.Value)); err != nil {
				a.internal(w, err)
				return
			}
		}
		setSessionCookie(w, r, "", -1)
		writeJSON(w, 200, map[string]bool{"ok": true})
		return
	}
	if endpoint != "register" && endpoint != "login" {
		jsonError(w, 404, "没有找到这个入口")
		return
	}
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	body.Username = strings.TrimSpace(body.Username)
	if !a.limiter.allow("auth:"+remoteKey(r), 50, 15*time.Minute) || !a.limiter.allow("user:"+strings.ToLower(body.Username), 20, 15*time.Minute) {
		jsonError(w, 429, "尝试有点频繁，稍等一会儿再来吧")
		return
	}
	if utf8.RuneCountInString(body.Username) < 2 || utf8.RuneCountInString(body.Username) > 24 || len(body.Password) < 6 || len(body.Password) > 72 {
		jsonError(w, 400, "名字请用 2–24 个字，密码请用 6–72 个字节")
		return
	}
	for _, ch := range body.Username {
		if !unicode.IsLetter(ch) && !unicode.IsDigit(ch) && ch != '_' && ch != '-' {
			jsonError(w, 400, "名字可以使用中文、字母、数字、下划线或短横线")
			return
		}
	}
	var account Account
	if endpoint == "register" {
		hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
		if err != nil {
			a.internal(w, err)
			return
		}
		account = Account{ID: newID(), Username: body.Username, PasswordHash: string(hash)}
		if err = a.store.createAccount(r.Context(), account); err != nil {
			if errors.Is(err, errExists) {
				jsonError(w, 409, "这个名字已经有人用啦，换一个试试吧")
			} else {
				a.internal(w, err)
			}
			return
		}
	} else {
		var err error
		account, err = a.store.findAccount(r.Context(), body.Username)
		if err != nil {
			if !errors.Is(err, errNotFound) {
				a.internal(w, err)
				return
			}
			_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(body.Password))
			jsonError(w, 401, "名字或密码不对，再试一次吧")
			return
		}
		if bcrypt.CompareHashAndPassword([]byte(account.PasswordHash), []byte(body.Password)) != nil {
			jsonError(w, 401, "名字或密码不对，再试一次吧")
			return
		}
	}
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		a.internal(w, err)
		return
	}
	token := hex.EncodeToString(b)
	if err := a.store.putSession(r.Context(), Session{TokenHash: tokenHash(token), UserID: account.ID, ExpiresAt: time.Now().Add(30 * 24 * time.Hour).UnixMilli()}); err != nil {
		a.internal(w, err)
		return
	}
	setSessionCookie(w, r, token, 30*24*3600)
	writeJSON(w, 200, map[string]any{"user": publicUser(account)})
}

var dummyHash = []byte("$2a$10$7EqJtq98hPqEX7fNZaFWoO5R.aPwMBbgDZsvVWKlpdPwnBT7/u8/G")

func (a *App) updateProfile(w http.ResponseWriter, r *http.Request) {
	u, ok := a.requireUser(w, r)
	if !ok {
		return
	}
	var body struct {
		Avatar *AvatarAppearance `json:"avatar"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	v := body.Avatar
	if v == nil || v.Skin < 0 || v.Skin > 5 || v.Hair < 0 || v.Hair > 5 || v.Outfit < 0 || v.Outfit > 7 || v.Hat < 0 || v.Hat > 3 {
		jsonError(w, 400, "请选择衣橱里已有的肤色、发型、衣服和帽子")
		return
	}
	if !a.limiter.allow("profile:"+u.ID, 30, time.Minute) {
		jsonError(w, 429, "换装有点快，稍等一会儿再试吧")
		return
	}
	if err := a.store.updateAvatar(r.Context(), u.ID, *v); err != nil {
		a.internal(w, err)
		return
	}
	u.Avatar = *v
	a.mu.RLock()
	for _, rr := range a.rooms {
		rr.mu.Lock()
		changed := false
		for c := range rr.clients {
			if c.user.ID == u.ID {
				c.user.Avatar = *v
				c.player.Avatar = *v
				changed = true
			}
		}
		if changed {
			rr.broadcast(map[string]any{"type": "presence", "players": rr.players()})
		}
		rr.mu.Unlock()
	}
	a.mu.RUnlock()
	writeJSON(w, 200, map[string]any{"user": u})
}
