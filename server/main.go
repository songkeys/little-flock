package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
func main() {
	store, err := openStore(os.Getenv("DATABASE_URL"), env("SAVE_PATH", "data/farm.json"))
	if err != nil {
		log.Fatal(err)
	}
	defer store.close()
	app, err := newApp(store, env("STATIC_DIR", "../dist"))
	if err != nil {
		log.Fatal(err)
	}
	srv := &http.Server{Addr: ":" + env("PORT", "8080"), Handler: app.routes(), ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 20 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 90 * time.Second}
	go func() {
		log.Printf("Little Flock listening on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)
	<-signals
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	app.shutdown()
}
