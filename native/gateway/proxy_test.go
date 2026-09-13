package gateway

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func fixture(t *testing.T, base string, handler http.HandlerFunc) (*Gateway, *http.Client) {
	t.Helper()
	upstream := httptest.NewServer(handler)
	t.Cleanup(upstream.Close)
	target, _ := url.Parse("http://nas:8096" + base)
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	g, err := Start(target, listener, func(ctx context.Context, network, address string) (net.Conn, error) {
		if address != "nas:8096" {
			t.Errorf("unexpected target %s", address)
		}
		return (&net.Dialer{}).DialContext(ctx, network, strings.TrimPrefix(upstream.URL, "http://"))
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = g.Close() })
	jar, _ := cookiejar.New(nil)
	client := &http.Client{Jar: jar, Timeout: 5 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := client.Get(g.URL())
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 303 || response.Header.Get("Location") != base+"/web/index.html" {
		t.Fatalf("bootstrap: %v", response)
	}
	if !response.Cookies()[0].HttpOnly || response.Cookies()[0].SameSite != http.SameSiteStrictMode {
		t.Fatal("insecure gateway cookie")
	}
	return g, client
}

func TestStreamingAndCredentials(t *testing.T) {
	media := strings.Repeat("abcdefgh", 1<<18)
	g, client := fixture(t, "/jellyfin", func(w http.ResponseWriter, r *http.Request) {
		if r.Host != "nas:8096" || r.URL.Path != "/jellyfin/Videos/1/stream.mp4" || r.URL.Query().Get("api_key") != "example-token" {
			t.Errorf("incorrect upstream request %s %s", r.Host, r.URL.Path)
		}
		if strings.Contains(r.Header.Get("Cookie"), cookieName) {
			t.Error("gateway credential escaped upstream")
		}
		if r.Header.Get("Authorization") != "MediaBrowser Token=example-token" {
			t.Error("lost Jellyfin authentication")
		}
		http.ServeContent(w, r, "stream.mp4", time.Time{}, strings.NewReader(media))
	})
	req, _ := http.NewRequest("GET", g.origin+"/jellyfin/Videos/1/stream.mp4?api_key=example-token", nil)
	req.Header.Set("Range", "bytes=100-199")
	req.Header.Set("Authorization", "MediaBrowser Token=example-token")
	r, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Body.Close()
	b, _ := io.ReadAll(r.Body)
	if r.StatusCode != 206 || string(b) != media[100:200] || r.Header.Get("Content-Range") != fmt.Sprintf("bytes 100-199/%d", len(media)) {
		t.Fatalf("range failed: %d %q", r.StatusCode, b)
	}
	if !strings.Contains(r.Header.Get("Content-Security-Policy"), "media-src 'self' blob:") {
		t.Fatal("missing route enforcement")
	}
}

func TestUnauthorizedRequestsNeverDial(t *testing.T) {
	g, client := fixture(t, "/jellyfin", func(http.ResponseWriter, *http.Request) { t.Error("unauthorized upstream request") })
	for _, test := range []struct {
		path, host, origin, method string
		authorized                 bool
		want                       int
	}{
		{"/jellyfin/Users", "", "", "GET", false, 401},
		{"/_jellyvega/open?token=wrong", "", "", "GET", false, 401},
		{"/jellyfin/Users", "evil.test", "", "GET", true, 403},
		{"/jellyfin/Users", "", "http://evil.test", "GET", true, 403},
		{"/outside", "", "", "GET", true, 403},
		{"/jellyfin/../outside", "", "", "GET", true, 403},
		{"/jellyfin/%2e%2e/outside", "", "", "GET", true, 403},
		{"/jellyfin/%252e%252e/outside", "", "", "GET", true, 403},
		{"/jellyfin/%2foutside", "", "", "GET", true, 403},
		{"/jellyfin/Users", "", "", "CONNECT", true, 403},
	} {
		t.Run(test.path+test.host+test.origin+test.method, func(t *testing.T) {
			req, _ := http.NewRequest(test.method, g.origin+test.path, nil)
			if test.host != "" {
				req.Host = test.host
			}
			req.Header.Set("Origin", test.origin)
			c := client
			if !test.authorized {
				c = &http.Client{Timeout: time.Second}
			}
			r, err := c.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			r.Body.Close()
			if r.StatusCode != test.want {
				t.Errorf("got %d want %d", r.StatusCode, test.want)
			}
		})
	}
}

func TestRedirectAndAdapter(t *testing.T) {
	g, client := fixture(t, "", func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/redirect":
			w.Header().Set("Location", "http://nas:8096/web/index.html")
			w.WriteHeader(302)
		case "/external":
			w.Header().Set("Location", "https://external.test/secret")
			w.WriteHeader(302)
		default:
			w.Header().Set("Content-Type", "text/html")
			w.Header().Set("ETag", "stale")
			io.WriteString(w, `<html><head><script src="main.js"></script></head><body>Jellyfin</body></html>`)
		}
	})
	for _, tc := range []struct {
		path     string
		status   int
		contains string
	}{
		{"/redirect", 302, ""}, {"/external", 502, "unreachable"},
		{"/web/index.html", 200, `<head><script src="/_jellyvega/adapter.js"></script><script`},
		{"/_jellyvega/adapter.js", 200, `const server = "http://nas:8096"`},
		{"/web/node_modules.%40jellyfin.sdk.bundle.js", 200, "Jellyfin"},
	} {
		r, err := client.Get(g.origin + tc.path)
		if err != nil {
			t.Fatal(err)
		}
		b, _ := io.ReadAll(r.Body)
		r.Body.Close()
		if r.StatusCode != tc.status || !strings.Contains(string(b), tc.contains) {
			t.Errorf("%s: %d %s", tc.path, r.StatusCode, b)
		}
		if tc.path == "/redirect" && r.Header.Get("Location") != "/web/index.html" {
			t.Error("redirect escaped gateway")
		}
		if tc.path == "/web/index.html" && (r.Header.Get("ETag") != "" || r.ContentLength != int64(len(b))) {
			t.Error("invalid rewritten HTML metadata")
		}
	}
}

func TestWebSocketAndShutdown(t *testing.T) {
	g, _ := fixture(t, "", func(w http.ResponseWriter, r *http.Request) {
		conn, buf, err := w.(http.Hijacker).Hijack()
		if err != nil {
			return
		}
		defer conn.Close()
		buf.WriteString("HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n")
		buf.Flush()
		io.Copy(conn, buf)
	})
	conn, err := net.DialTimeout("tcp", g.listener.Addr().String(), time.Second)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(5 * time.Second))
	fmt.Fprintf(conn, "GET /socket HTTP/1.1\r\nHost: %s\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nCookie: %s=%s\r\nOrigin: %s\r\n\r\n", g.listener.Addr(), cookieName, g.token, g.origin)
	reader := bufio.NewReader(conn)
	r, err := http.ReadResponse(reader, nil)
	if err != nil {
		t.Fatal(err)
	}
	if r.StatusCode != 101 {
		t.Fatalf("upgrade failed: %d", r.StatusCode)
	}
	conn.Write([]byte("socket-echo"))
	b := make([]byte, 11)
	if _, err := io.ReadFull(reader, b); err != nil || string(b) != "socket-echo" {
		t.Fatalf("echo: %q %v", b, err)
	}
	g.Close()
	if _, err := reader.ReadByte(); err == nil {
		t.Fatal("socket survived shutdown")
	}
}

func TestParseTarget(t *testing.T) {
	for _, raw := range []string{"http://nas:8096", "https://nas.example.ts.net", "http://100.64.0.1:8096/jellyfin/", "http://[fd7a:115c:a1e0::1]:8096"} {
		if _, err := ParseTarget(raw); err != nil {
			t.Errorf("rejected %s: %v", raw, err)
		}
	}
	for _, raw := range []string{"", "nas", "ftp://nas", "http://user:pass@nas", "http://nas?api_key=secret", "http://nas/#foo", "http://127.0.0.1", "http://192.168.0.1", "http://8.8.8.8", "http://[::1]", "http://localhost", "http://nas:0", "http://nas:65536", "http://nas/web/index.html", "http://nas/a/../b", "http://nas/%2f"} {
		if _, err := ParseTarget(raw); err == nil {
			t.Errorf("accepted %s", raw)
		}
	}
}
