package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var errNotFound = errors.New("not found")
var errExists = errors.New("already exists")

type diskData struct {
	Accounts map[string]Account         `json:"accounts"`
	Sessions map[string]Session         `json:"sessions"`
	Rooms    map[string]json.RawMessage `json:"rooms"`
}
type Store struct {
	mu   sync.Mutex
	path string
	data diskData
	db   *pgxpool.Pool
}

func openStore(databaseURL, path string) (*Store, error) {
	s := &Store{path: path, data: diskData{Accounts: map[string]Account{}, Sessions: map[string]Session{}, Rooms: map[string]json.RawMessage{}}}
	if databaseURL != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		db, err := pgxpool.New(ctx, databaseURL)
		if err != nil {
			return nil, err
		}
		s.db = db
		_, err = db.Exec(ctx, `CREATE TABLE IF NOT EXISTS sheep_accounts (id TEXT PRIMARY KEY, username TEXT NOT NULL, username_key TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, avatar JSONB NOT NULL DEFAULT '{"skin":0,"hair":0,"outfit":0,"hat":0}'::jsonb);
ALTER TABLE sheep_accounts ADD COLUMN IF NOT EXISTS avatar JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS sheep_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES sheep_accounts(id) ON DELETE CASCADE, expires_at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS sheep_sessions_expiry ON sheep_sessions(expires_at);
CREATE TABLE IF NOT EXISTS sheep_rooms (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());`)
		if err != nil {
			db.Close()
			return nil, err
		}
		return s, nil
	}
	b, err := os.ReadFile(path)
	if err == nil {
		if err = json.Unmarshal(b, &s.data); err != nil {
			return nil, fmt.Errorf("read farm save: %w", err)
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	return s, nil
}
func (s *Store) close() {
	if s.db != nil {
		s.db.Close()
	}
}
func (s *Store) flush() error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0700); err != nil {
		return err
	}
	b, err := json.Marshal(s.data)
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err = os.WriteFile(tmp, b, 0600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}
func (s *Store) createAccount(ctx context.Context, a Account) error {
	if s.db != nil {
		_, err := s.db.Exec(ctx, `INSERT INTO sheep_accounts(id,username,username_key,password_hash,avatar) VALUES($1,$2,$3,$4,$5) ON CONFLICT(username_key) DO NOTHING`, a.ID, a.Username, strings.ToLower(a.Username), a.PasswordHash, a.Avatar)
		if err != nil {
			return err
		}
		got, err := s.findAccount(ctx, a.Username)
		if err != nil {
			return err
		}
		if got.ID != a.ID {
			return errExists
		}
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	key := strings.ToLower(a.Username)
	if _, ok := s.data.Accounts[key]; ok {
		return errExists
	}
	s.data.Accounts[key] = a
	if err := s.flush(); err != nil {
		delete(s.data.Accounts, key)
		return err
	}
	return nil
}
func (s *Store) findAccount(ctx context.Context, name string) (Account, error) {
	if s.db != nil {
		var a Account
		err := s.db.QueryRow(ctx, `SELECT id,username,password_hash,avatar FROM sheep_accounts WHERE username_key=$1`, strings.ToLower(name)).Scan(&a.ID, &a.Username, &a.PasswordHash, &a.Avatar)
		if errors.Is(err, pgx.ErrNoRows) {
			err = errNotFound
		}
		return a, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	a, ok := s.data.Accounts[strings.ToLower(name)]
	if !ok {
		return a, errNotFound
	}
	return a, nil
}
func (s *Store) putSession(ctx context.Context, se Session) error {
	if s.db != nil {
		_, err := s.db.Exec(ctx, `INSERT INTO sheep_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)`, se.TokenHash, se.UserID, se.ExpiresAt)
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for k, v := range s.data.Sessions {
		if v.ExpiresAt < nowMS() {
			delete(s.data.Sessions, k)
		}
	}
	s.data.Sessions[se.TokenHash] = se
	if err := s.flush(); err != nil {
		delete(s.data.Sessions, se.TokenHash)
		return err
	}
	return nil
}
func (s *Store) sessionUser(ctx context.Context, hash string) (User, error) {
	if s.db != nil {
		var u User
		err := s.db.QueryRow(ctx, `SELECT a.id,a.username,a.avatar FROM sheep_sessions s JOIN sheep_accounts a ON a.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>$2`, hash, nowMS()).Scan(&u.ID, &u.Username, &u.Avatar)
		if errors.Is(err, pgx.ErrNoRows) {
			err = errNotFound
		}
		return u, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	se, ok := s.data.Sessions[hash]
	if !ok || se.ExpiresAt <= nowMS() {
		return User{}, errNotFound
	}
	for _, a := range s.data.Accounts {
		if a.ID == se.UserID {
			return publicUser(a), nil
		}
	}
	return User{}, errNotFound
}
func (s *Store) deleteSession(ctx context.Context, hash string) error {
	if s.db != nil {
		_, err := s.db.Exec(ctx, `DELETE FROM sheep_sessions WHERE token_hash=$1`, hash)
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	old, ok := s.data.Sessions[hash]
	delete(s.data.Sessions, hash)
	if err := s.flush(); err != nil {
		if ok {
			s.data.Sessions[hash] = old
		}
		return err
	}
	return nil
}
func (s *Store) saveRoom(ctx context.Context, r RoomRecord) error {
	b, err := json.Marshal(r)
	if err != nil {
		return err
	}
	if s.db != nil {
		_, err = s.db.Exec(ctx, `INSERT INTO sheep_rooms(id,code,data) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=now()`, r.Room.ID, r.Room.Code, b)
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	old, ok := s.data.Rooms[r.Room.ID]
	s.data.Rooms[r.Room.ID] = b
	if err = s.flush(); err != nil {
		if ok {
			s.data.Rooms[r.Room.ID] = old
		} else {
			delete(s.data.Rooms, r.Room.ID)
		}
	}
	return err
}
func (s *Store) loadRooms(ctx context.Context) ([]RoomRecord, error) {
	out := []RoomRecord{}
	if s.db != nil {
		rows, err := s.db.Query(ctx, `SELECT data FROM sheep_rooms ORDER BY updated_at DESC`)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var b []byte
			if err = rows.Scan(&b); err != nil {
				return nil, err
			}
			var r RoomRecord
			if err = json.Unmarshal(b, &r); err != nil {
				return nil, err
			}
			out = append(out, r)
		}
		return out, rows.Err()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, b := range s.data.Rooms {
		var r RoomRecord
		if err := json.Unmarshal(b, &r); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, nil
}

func (s *Store) updateAvatar(ctx context.Context, userID string, avatar AvatarAppearance) error {
	if s.db != nil {
		result, err := s.db.Exec(ctx, `UPDATE sheep_accounts SET avatar=$2 WHERE id=$1`, userID, avatar)
		if err == nil && result.RowsAffected() == 0 {
			return errNotFound
		}
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for key, account := range s.data.Accounts {
		if account.ID != userID {
			continue
		}
		updated := account
		updated.Avatar = avatar
		s.data.Accounts[key] = updated
		if err := s.flush(); err != nil {
			s.data.Accounts[key] = account
			return err
		}
		return nil
	}
	return errNotFound
}

func (s *Store) deleteRoom(ctx context.Context, id string) error {
	if s.db != nil {
		_, err := s.db.Exec(ctx, `DELETE FROM sheep_rooms WHERE id=$1`, id)
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	old, exists := s.data.Rooms[id]
	delete(s.data.Rooms, id)
	if err := s.flush(); err != nil {
		if exists {
			s.data.Rooms[id] = old
		}
		return err
	}
	return nil
}
