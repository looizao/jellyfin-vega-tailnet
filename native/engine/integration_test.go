//go:build integration

package engine

import (
	"context"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"tailscale.com/net/netns"
	"tailscale.com/tsnet"
	"tailscale.com/tstest/integration"
	"tailscale.com/tstest/integration/testcontrol"
	"tailscale.com/types/logger"
)

func TestLocalTailnetStreamingAndReconnect(t *testing.T) {
	// Real WireGuard engines, control protocol, DERP, and STUN. No production
	// tailnet, credentials, system TUN, or external coordination server is used.
	netns.SetEnabled(false)
	t.Cleanup(func() { netns.SetEnabled(true) })
	t.Setenv("TS_DEBUG_LOGTAIL", "false")
	control := &testcontrol.Server{DERPMap: integration.RunDERPAndSTUN(t, logger.Discard, "127.0.0.1")}
	control.HTTPTestServer = httptest.NewUnstartedServer(control)
	control.HTTPTestServer.Start()
	t.Cleanup(control.HTTPTestServer.Close)
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	nas := &tsnet.Server{Dir: t.TempDir(), Hostname: "nas", ControlURL: control.HTTPTestServer.URL, Logf: logger.Discard, UserLogf: logger.Discard}
	if _, err := nas.Up(ctx); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { nas.Close() })
	listener, err := nas.Listen("tcp", ":8096")
	if err != nil {
		t.Fatal(err)
	}
	media := strings.Repeat("private-tailnet-video-", 1<<16)
	server := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/System/Info/Public":
			w.Header().Set("Content-Type", "application/json")
			io.WriteString(w, `{"ProductName":"Jellyfin","ServerName":"Local tailnet fixture","Version":"test"}`)
		case "/web/index.html":
			w.Header().Set("Content-Type", "text/html")
			io.WriteString(w, `<html><head></head><body>Jellyfin over a real userspace tailnet</body></html>`)
		default:
			http.ServeContent(w, r, "video.mp4", time.Time{}, strings.NewReader(media))
		}
	})}
	go server.Serve(listener)
	t.Cleanup(func() { server.Close() })
	e := New(t.TempDir())
	e.controlURL = control.HTTPTestServer.URL
	e.listenAddr = "127.0.0.1:0"
	t.Cleanup(e.Stop)
	if _, err := e.Start(Config{ServerURL: "http://nas:8096", Hostname: "jellyvega-test"}); err != nil {
		t.Fatal(err)
	}
	if _, err := e.server.Up(ctx); err != nil {
		t.Fatal(err)
	}
	first, err := e.Status()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := e.Check(); err != nil {
		t.Fatal(err)
	}
	jar, _ := cookiejar.New(nil)
	client := &http.Client{Jar: jar, Timeout: 10 * time.Second}
	r, err := client.Get(first.WebURL)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := io.ReadAll(r.Body)
	r.Body.Close()
	if r.StatusCode != 200 || !strings.Contains(string(b), "real userspace tailnet") || !strings.Contains(string(b), "adapter.js") {
		t.Fatalf("web through tailnet: %d %s", r.StatusCode, b)
	}
	req, _ := http.NewRequest("GET", e.gateway.URL()[:strings.Index(e.gateway.URL(), "/_jellyvega")]+"/Videos/1/stream.mp4", nil)
	req.Header.Set("Range", "bytes=1000-9191")
	r, err = client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	b, _ = io.ReadAll(r.Body)
	r.Body.Close()
	if r.StatusCode != 206 || string(b) != media[1000:9192] {
		t.Fatalf("streaming seek failed: %d, %d bytes", r.StatusCode, len(b))
	}
	settings, _ := os.ReadFile(filepath.Join(e.dir, "settings.json"))
	if strings.Contains(string(settings), "authKey") {
		t.Fatal("saved enrollment credential")
	}
	info, _ := os.Stat(filepath.Join(e.dir, "settings.json"))
	if info.Mode().Perm() != 0600 {
		t.Fatal("settings permissions")
	}
	e.Stop()
	if _, err := e.Start(Config{}); err != nil {
		t.Fatal(err)
	}
	if _, err := e.server.Up(ctx); err != nil {
		t.Fatal(err)
	}
	second, _ := e.Status()
	if first.IPs[0] != second.IPs[0] {
		t.Fatal("node identity changed on reconnect")
	}
	if _, err := e.Check(); err != nil {
		t.Fatal(err)
	}
	t.Log("Verified real tailnet HTTP, streamed range seek, private state, and identity reuse")
}
