//go:build integration

package engine

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"os"
	"tailscale.com/net/netns"
	"tailscale.com/tsnet"
	"tailscale.com/tstest/integration"
	"tailscale.com/tstest/integration/testcontrol"
	"tailscale.com/types/logger"
	"testing"
	"time"
)

// scripts/test-browser.sh owns this disposable tailnet and its credentials.
func TestBrowserFixture(t *testing.T) {
	readyFile := os.Getenv("JELLYVEGA_BROWSER_READY")
	if readyFile == "" {
		t.Skip("started only by the browser test script")
	}
	netns.SetEnabled(false)
	t.Cleanup(func() { netns.SetEnabled(true) })
	t.Setenv("TS_DEBUG_LOGTAIL", "false")
	control := &testcontrol.Server{DERPMap: integration.RunDERPAndSTUN(t, logger.Discard, "127.0.0.1")}
	control.HTTPTestServer = httptest.NewUnstartedServer(control)
	control.HTTPTestServer.Start()
	defer control.HTTPTestServer.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	nas := &tsnet.Server{Dir: t.TempDir(), Hostname: "nas", ControlURL: control.HTTPTestServer.URL, Logf: logger.Discard, UserLogf: logger.Discard}
	if _, err := nas.Up(ctx); err != nil {
		t.Fatal(err)
	}
	defer nas.Close()
	listener, err := nas.Listen("tcp", ":8096")
	if err != nil {
		t.Fatal(err)
	}
	target, _ := url.Parse("http://127.0.0.1:18096")
	upstream := &http.Server{Handler: httputil.NewSingleHostReverseProxy(target)}
	go upstream.Serve(listener)
	defer upstream.Close()
	e := New(t.TempDir())
	e.controlURL = control.HTTPTestServer.URL
	defer e.Stop()
	if _, err := e.Start(Config{ServerURL: "http://nas:8096", Hostname: "jellyvega-browser"}); err != nil {
		t.Fatal(err)
	}
	if _, err := e.server.Up(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := e.Check(); err != nil {
		t.Fatal(err)
	}
	s, err := e.Status()
	if err != nil {
		t.Fatal(err)
	}
	data, _ := json.Marshal(s)
	if err := os.WriteFile(readyFile, data, 0600); err != nil {
		t.Fatal(err)
	}
	<-t.Context().Done()
}
