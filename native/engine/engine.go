// Package engine owns the embedded Tailscale node and its Jellyfin gateway.
package engine

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/netip"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/looizao/jellyfin-vega-tailnet/native/gateway"
	"tailscale.com/ipn/ipnstate"
	"tailscale.com/tsnet"
	"tailscale.com/types/logger"
)

const Version = "JellyVega 0.1.0 / Tailscale 1.102.4"

type Config struct {
	ServerURL string `json:"serverUrl"`
	Hostname  string `json:"hostname"`
	AuthKey   string `json:"authKey,omitempty"`
}

type Snapshot struct {
	State     string   `json:"state"`
	ServerURL string   `json:"serverUrl"`
	Hostname  string   `json:"hostname"`
	WebURL    string   `json:"webUrl,omitempty"`
	AuthURL   string   `json:"authUrl,omitempty"`
	IPs       []string `json:"ips"`
	Health    []string `json:"health,omitempty"`
}

type Engine struct {
	mu      sync.Mutex
	dir     string
	config  Config
	server  *tsnet.Server
	gateway *gateway.Gateway
	// These overrides are used by local integration tests, never by the TV UI.
	controlURL string
	listenAddr string
}

func New(dir string) *Engine { return &Engine{dir: dir, listenAddr: "127.0.0.1:18765"} }

func (e *Engine) Start(config Config) (Snapshot, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if config.ServerURL == "" {
		data, err := os.ReadFile(filepath.Join(e.dir, "settings.json"))
		if errors.Is(err, os.ErrNotExist) {
			return Snapshot{State: "Stopped", IPs: []string{}}, nil
		}
		if err != nil || json.Unmarshal(data, &config) != nil {
			return Snapshot{}, errors.New("could not read saved settings; enter the server URL again")
		}
	}
	target, err := gateway.ParseTarget(config.ServerURL)
	if err != nil {
		return Snapshot{}, err
	}
	config.ServerURL = target.String()
	if config.Hostname == "" {
		config.Hostname = "jellyvega-fire-tv"
	}
	if len(config.Hostname) > 63 || strings.Trim(config.Hostname, "abcdefghijklmnopqrstuvwxyz0123456789-") != "" || strings.HasPrefix(config.Hostname, "-") || strings.HasSuffix(config.Hostname, "-") {
		return Snapshot{}, errors.New("use a device name with lowercase letters, numbers, and internal hyphens")
	}
	if e.server != nil {
		if e.config.ServerURL == config.ServerURL && e.config.Hostname == config.Hostname && config.AuthKey == "" {
			return e.snapshotLocked()
		}
		e.stopLocked()
	}
	if err := os.MkdirAll(e.dir, 0700); err != nil {
		return Snapshot{}, errors.New("could not create the private app data directory")
	}
	if err := os.Chmod(e.dir, 0700); err != nil {
		return Snapshot{}, err
	}
	node := &tsnet.Server{
		Dir: filepath.Join(e.dir, "tailscale"), Hostname: config.Hostname,
		AuthKey: config.AuthKey, ControlURL: e.controlURL,
		Logf: logger.Discard, UserLogf: logger.Discard,
	}
	if err := node.Start(); err != nil {
		return Snapshot{}, errors.New("could not start Tailscale; check the app's storage and network")
	}
	e.server = node
	config.AuthKey = "" // Persist preferences only, never an enrollment credential.
	e.config = config
	listener, err := net.Listen("tcp4", e.listenAddr)
	if err != nil {
		e.stopLocked()
		return Snapshot{}, errors.New("could not open the local Jellyfin port; close another JellyVega instance")
	}
	g, err := gateway.Start(target, listener, tailnetDial(node))
	if err != nil {
		_ = listener.Close()
		e.stopLocked()
		return Snapshot{}, err
	}
	e.gateway = g
	data, _ := json.Marshal(config)
	file := filepath.Join(e.dir, "settings.json")
	if err := os.WriteFile(file+".tmp", data, 0600); err != nil {
		e.stopLocked()
		return Snapshot{}, errors.New("could not save server settings")
	}
	if err := os.Rename(file+".tmp", file); err != nil {
		e.stopLocked()
		return Snapshot{}, errors.New("could not save server settings")
	}
	return e.snapshotLocked()
}

func (e *Engine) Status() (Snapshot, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.snapshotLocked()
}

func (e *Engine) snapshotLocked() (Snapshot, error) {
	s := Snapshot{State: "Stopped", ServerURL: e.config.ServerURL, Hostname: e.config.Hostname, IPs: []string{}}
	if e.server == nil {
		return s, nil
	}
	lc, err := e.server.LocalClient()
	if err != nil {
		return s, errors.New("Tailscale status is unavailable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	status, err := lc.Status(ctx)
	if err != nil {
		return s, errors.New("Tailscale status is unavailable")
	}
	s.State, s.AuthURL, s.Health = status.BackendState, status.AuthURL, status.Health
	for _, ip := range status.TailscaleIPs {
		s.IPs = append(s.IPs, ip.String())
	}
	if s.State == "Running" && e.gateway != nil {
		s.WebURL = e.gateway.URL()
	}
	return s, nil
}

func (e *Engine) Stop() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.stopLocked()
}

func (e *Engine) stopLocked() {
	if e.gateway != nil {
		_ = e.gateway.Close()
		e.gateway = nil
	}
	if e.server != nil {
		_ = e.server.Close()
		e.server = nil
	}
}

// Check uses exactly the same tailnet dialer as playback. It never follows a
// redirect to a different host or includes credentials in an error message.
func (e *Engine) Check() (string, error) {
	e.mu.Lock()
	if e.server == nil {
		e.mu.Unlock()
		return "", errors.New("connect to Tailscale first")
	}
	node, baseURL := e.server, e.config.ServerURL
	e.mu.Unlock()
	transport := &http.Transport{DialContext: tailnetDial(node)}
	defer transport.CloseIdleConnections()
	client := &http.Client{Transport: transport, Timeout: 15 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	r, err := client.Get(baseURL + "/System/Info/Public")
	if err != nil {
		return "", errors.New("Jellyfin is unreachable; check its MagicDNS name, port, TLS certificate, and tailnet access rules")
	}
	defer r.Body.Close()
	var info struct{ ProductName, ServerName, Version string }
	if r.StatusCode != 200 || json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&info) != nil || (info.ProductName != "Jellyfin" && info.ProductName != "Jellyfin Server") {
		return "", errors.New("the URL did not return Jellyfin server information; check the server base path")
	}
	return info.ServerName + " · " + info.Version, nil
}

func tailnetDial(node *tsnet.Server) gateway.DialFunc {
	return func(ctx context.Context, network, address string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, err
		}
		lc, err := node.LocalClient()
		if err != nil {
			return nil, err
		}
		status, err := lc.Status(ctx)
		if err != nil {
			return nil, err
		}
		ip, err := peerIP(status, host)
		if err != nil {
			return nil, err
		}
		return node.Dial(ctx, network, net.JoinHostPort(ip.String(), port))
	}
}

// Resolve through Tailscale's authenticated network map. tsnet can also dial
// ordinary internet destinations; this guard intentionally prevents that fallback.
func peerIP(status *ipnstate.Status, host string) (netip.Addr, error) {
	if ip, err := netip.ParseAddr(host); err == nil && gateway.IsTailnetIP(ip) {
		return ip, nil
	}
	host = strings.TrimSuffix(strings.ToLower(host), ".")
	peers := []*ipnstate.PeerStatus{status.Self}
	for _, peer := range status.Peer {
		peers = append(peers, peer)
	}
	for _, peer := range peers {
		if peer == nil {
			continue
		}
		dnsName := strings.TrimSuffix(strings.ToLower(peer.DNSName), ".")
		short, _, _ := strings.Cut(dnsName, ".")
		if host == dnsName || host == short {
			for _, ip := range peer.TailscaleIPs {
				if gateway.IsTailnetIP(ip) {
					return ip, nil
				}
			}
		}
	}
	return netip.Addr{}, errors.New("server is not a visible tailnet peer; use its Tailscale IP or MagicDNS name")
}
