package main

import (
	"context"
	"errors"
	"net/url"
	"os"
	"reflect"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Uses a disposable schema. Set TEST_DATABASE_URL to a local test database.
func TestPostgresPersistence(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL unset")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := "flock_test_" + newID()
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if _, err := admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Error(err)
		}
	}()
	u, err := url.Parse(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()
	s, err := openStore(u.String(), "")
	if err != nil {
		t.Fatal(err)
	}
	defer s.close()
	account := Account{ID: newID(), Username: "TestFarmer", PasswordHash: "bcrypt-is-tested-by-auth-tests"}
	if err = s.createAccount(ctx, account); err != nil {
		t.Fatal(err)
	}
	duplicate := account
	duplicate.ID = newID()
	duplicate.Username = "testfarmer"
	if err = s.createAccount(ctx, duplicate); !errors.Is(err, errExists) {
		t.Fatalf("duplicate result = %v", err)
	}
	session := Session{TokenHash: tokenHash("test-only-token"), UserID: account.ID, ExpiresAt: nowMS() + 3600000}
	if err = s.putSession(ctx, session); err != nil {
		t.Fatal(err)
	}
	state := establishedFarm(nowMS())
	state.Coins = 321
	state.Progression.ForestFinds = 3
	state.Progression.LastStargazeDay = 4
	state.ForageNodes[0].ReadyAt = nowMS() + 180000
	state.Grazing = GrazingState{Active: true, LeaderID: &account.ID, RegionID: "meadow", StartedAt: nowMS(), GrazeSeconds: 12, Watered: true, CompletedCount: 2}
	record := RoomRecord{Room: Room{ID: newID(), Code: "PGTEST", Name: "数据库农场", OwnerID: account.ID}, Members: map[string]bool{account.ID: true}, State: state}
	if err = s.saveRoom(ctx, record); err != nil {
		t.Fatal(err)
	}
	// Opening a fresh pool repeats idempotent setup and retrieves the persisted JSONB.
	reopened, err := openStore(u.String(), "")
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.close()
	records, err := reopened.loadRooms(ctx)
	if err != nil || len(records) != 1 || !reflect.DeepEqual(records[0].State, state) || !records[0].Members[account.ID] {
		t.Fatalf("roundtrip: %v %+v", err, records)
	}
	avatar := AvatarAppearance{Skin: 5, Hair: 4, Outfit: 7, Hat: 3}
	if err := s.updateAvatar(ctx, account.ID, avatar); err != nil {
		t.Fatal(err)
	}
	savedAccount, err := reopened.findAccount(ctx, account.Username)
	if err != nil || savedAccount.Avatar != avatar {
		t.Fatalf("avatar roundtrip: %v %+v", err, savedAccount)
	}
	user, err := reopened.sessionUser(ctx, session.TokenHash)
	if err != nil || user.ID != account.ID || user.Avatar != avatar {
		t.Fatalf("session roundtrip: %v %+v", err, user)
	}
	if err := s.deleteRoom(ctx, record.Room.ID); err != nil {
		t.Fatal(err)
	}
	remaining, err := reopened.loadRooms(ctx)
	if err != nil || len(remaining) != 0 {
		t.Fatalf("room deletion roundtrip: %v %+v", err, remaining)
	}
	if err = reopened.deleteSession(ctx, session.TokenHash); err != nil {
		t.Fatal(err)
	}
	if _, err = reopened.sessionUser(ctx, session.TokenHash); !errors.Is(err, errNotFound) {
		t.Fatal("revoked session remained valid")
	}
}

func TestPostgresAddsAvatarToOriginalAccountsSchema(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL unset")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := "flock_upgrade_" + newID()
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if _, err := admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Error(err)
		}
	}()
	u, err := url.Parse(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	query := u.Query()
	query.Set("search_path", schema)
	u.RawQuery = query.Encode()
	original, err := pgxpool.New(ctx, u.String())
	if err != nil {
		t.Fatal(err)
	}
	defer original.Close()
	// Exact account table shape created by the initial provisioned release.
	if _, err := original.Exec(ctx, `CREATE TABLE sheep_accounts (id TEXT PRIMARY KEY, username TEXT NOT NULL, username_key TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL);
INSERT INTO sheep_accounts(id,username,username_key,password_hash) VALUES ('original-owner','OriginalOwner','originalowner','existing-password-hash');`); err != nil {
		t.Fatal(err)
	}
	store, err := openStore(u.String(), "")
	if err != nil {
		t.Fatal(err)
	}
	defer store.close()
	account, err := store.findAccount(ctx, "OriginalOwner")
	if err != nil || account.ID != "original-owner" || account.PasswordHash != "existing-password-hash" || account.Avatar != (AvatarAppearance{}) {
		t.Fatalf("original account changed during the additive update: %v %+v", err, account)
	}
	session := Session{TokenHash: tokenHash("upgrade-session"), UserID: account.ID, ExpiresAt: nowMS() + 3600000}
	if err := store.putSession(ctx, session); err != nil {
		t.Fatal(err)
	}
	avatar := AvatarAppearance{Skin: 3, Hair: 5, Outfit: 6, Hat: 2}
	if err := store.updateAvatar(ctx, account.ID, avatar); err != nil {
		t.Fatal(err)
	}
	// Reopening reruns the additive DDL and must preserve the selected appearance.
	reopened, err := openStore(u.String(), "")
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.close()
	user, err := reopened.sessionUser(ctx, session.TokenHash)
	if err != nil || user.ID != account.ID || user.Avatar != avatar {
		t.Fatalf("existing account profile/session failed after reopening: %v %+v", err, user)
	}
	if err := reopened.createAccount(ctx, Account{ID: newID(), Username: "NewOwner", PasswordHash: "new-hash"}); err != nil {
		t.Fatal("new account insert failed against updated schema:", err)
	}
}
