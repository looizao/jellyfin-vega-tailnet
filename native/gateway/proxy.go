package gateway

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path"
	"regexp"
	"strings"
	"sync"
	"time"
)

const cookieName = "jellyvega_session"
const bootstrapPath = "/_jellyvega/open"

var unsafeEscape = regexp.MustCompile(`(?i)%(2f|5c|00|25)`)

type DialFunc func(context.Context, string, string) (net.Conn, error)

type Gateway struct {
	server    *http.Server
	transport *http.Transport
	listener  net.Listener
	target    *url.URL
	token     string
	origin    string
	mu        sync.Mutex
	conns     map[*trackedConn]bool
	closed    bool
}

// Start accepts only a loopback listener. All outbound connections use dial;
// HTTP_PROXY, system DNS, and the host's ordinary network route are never used.
func Start(target *url.URL, listener net.Listener, dial DialFunc) (*Gateway, error) {
	addr, ok := listener.Addr().(*net.TCPAddr)
	if !ok || !addr.IP.IsLoopback() || target == nil || dial == nil {
		return nil, errors.New("a loopback TCP listener, target, and tailnet dialer are required")
	}
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		return nil, err
	}
	g := &Gateway{listener: listener, target: target, token: hex.EncodeToString(secret), origin: "http://" + listener.Addr().String(), conns: make(map[*trackedConn]bool)}
	g.transport = &http.Transport{
		Proxy: nil, DialContext: g.trackDial(dial),
		MaxIdleConns: 16, MaxIdleConnsPerHost: 8, MaxConnsPerHost: 24,
		IdleConnTimeout: 60 * time.Second, TLSHandshakeTimeout: 10 * time.Second,
		ResponseHeaderTimeout: 30 * time.Second, ExpectContinueTimeout: time.Second,
	}
	p := &httputil.ReverseProxy{
		Transport: g.transport,
		Rewrite: func(r *httputil.ProxyRequest) {
			r.Out.URL.Scheme, r.Out.URL.Host = target.Scheme, target.Host
			r.Out.Host = target.Host
			// The incoming path already includes Jellyfin's optional base path.
			if r.Out.Header.Get("Origin") != "" {
				r.Out.Header.Set("Origin", target.Scheme+"://"+target.Host)
			}
			r.Out.Header.Del("Referer")
			if r.Out.URL.Path == target.Path+"/web/index.html" {
				r.Out.Header.Del("Accept-Encoding")
				r.Out.Header.Del("If-None-Match")
				r.Out.Header.Del("If-Modified-Since")
			}
			r.Out.Header.Del("Cookie")
			for _, c := range r.In.Cookies() {
				if c.Name != cookieName {
					r.Out.AddCookie(c)
				}
			}
		},
		ModifyResponse: g.modifyResponse,
		// Errors can contain URLs with Jellyfin access tokens. Never log them.
		ErrorLog: log.New(io.Discard, "", 0),
		ErrorHandler: func(w http.ResponseWriter, _ *http.Request, _ error) {
			http.Error(w, "Jellyfin is unreachable through the tailnet. Check the server and tailnet access rules.", http.StatusBadGateway)
		},
	}
	g.server = &http.Server{
		Handler: g.authorize(p), ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout: 60 * time.Second, MaxHeaderBytes: 64 << 10,
		ErrorLog: log.New(io.Discard, "", 0),
	}
	go func() { _ = g.server.Serve(listener) }()
	return g, nil
}

func (g *Gateway) URL() string { return g.origin + bootstrapPath + "?token=" + g.token }

func (g *Gateway) authorize(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if r.Host != g.listener.Addr().String() || r.URL.IsAbs() {
			http.Error(w, "invalid host", http.StatusForbidden)
			return
		}
		if origin := r.Header.Get("Origin"); origin != "" && origin != g.origin {
			http.Error(w, "invalid origin", http.StatusForbidden)
			return
		}
		if r.URL.Path == bootstrapPath {
			w.Header().Set("Cache-Control", "no-store")
			if r.Method != http.MethodGet || !g.validToken(r.URL.Query().Get("token")) {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			http.SetCookie(w, &http.Cookie{Name: cookieName, Value: g.token, Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode})
			http.Redirect(w, r, g.target.Path+"/web/index.html", http.StatusSeeOther)
			return
		}
		cookie, err := r.Cookie(cookieName)
		if err != nil || !g.validToken(cookie.Value) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if r.URL.Path == "/_jellyvega/adapter.js" {
			w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
			w.Header().Set("Cache-Control", "no-store")
			_, _ = io.WriteString(w, g.adapter())
			return
		}
		if r.Header.Get("Service-Worker") == "script" {
			http.Error(w, "offline caching is unavailable", http.StatusNotFound)
			return
		}
		if r.Method == http.MethodConnect || unsafeEscape.MatchString(r.URL.EscapedPath()) || strings.Contains(r.URL.Path, "\\") || path.Clean(r.URL.Path) != strings.TrimSuffix(r.URL.Path, "/") && r.URL.Path != "/" || (g.target.Path != "" && r.URL.Path != g.target.Path && !strings.HasPrefix(r.URL.Path, g.target.Path+"/")) {
			http.Error(w, "invalid path", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (g *Gateway) validToken(token string) bool {
	return subtle.ConstantTimeCompare([]byte(token), []byte(g.token)) == 1
}

func (g *Gateway) modifyResponse(r *http.Response) error {
	if err := g.injectAdapter(r); err != nil {
		return err
	}
	if location := r.Header.Get("Location"); location != "" {
		u, err := url.Parse(location)
		if err != nil || u.User != nil || u.Host != "" && u.Host != g.target.Host || u.Scheme != "" && u.Scheme != g.target.Scheme {
			return errors.New("external redirect blocked")
		}
		if u.Host != "" {
			u.Scheme, u.Host = "", ""
			r.Header.Set("Location", u.String())
		}
	}
	cookies := r.Cookies()
	r.Header.Del("Set-Cookie")
	for _, c := range cookies {
		if c.Name == cookieName {
			continue
		}
		c.Domain, c.Secure = "", false // Browser side is authenticated loopback HTTP.
		r.Header.Add("Set-Cookie", c.String())
	}
	// Enforce the same route for media, API calls, sockets, and plugin assets.
	r.Header.Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://"+g.listener.Addr().String()+"; media-src 'self' blob:; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'")
	r.Header.Set("Referrer-Policy", "no-referrer")
	r.Header.Del("Alt-Svc")
	return nil
}

func (g *Gateway) Close() error {
	g.mu.Lock()
	g.closed = true
	connections := make([]*trackedConn, 0, len(g.conns))
	for c := range g.conns {
		connections = append(connections, c)
	}
	g.mu.Unlock()
	for _, c := range connections {
		_ = c.Close() // Includes upgraded WebSocket connections.
	}
	g.transport.CloseIdleConnections()
	return g.server.Close()
}

type trackedConn struct {
	net.Conn
	owner *Gateway
	once  sync.Once
}

func (c *trackedConn) Close() error {
	err := c.Conn.Close()
	c.once.Do(func() {
		c.owner.mu.Lock()
		delete(c.owner.conns, c)
		c.owner.mu.Unlock()
	})
	return err
}

func (g *Gateway) trackDial(dial DialFunc) DialFunc {
	return func(ctx context.Context, network, address string) (net.Conn, error) {
		ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
		defer cancel()
		conn, err := dial(ctx, network, address)
		if err != nil {
			return nil, err
		}
		g.mu.Lock()
		defer g.mu.Unlock()
		if g.closed {
			_ = conn.Close()
			return nil, net.ErrClosed
		}
		c := &trackedConn{Conn: conn, owner: g}
		g.conns[c] = true
		return c, nil
	}
}
