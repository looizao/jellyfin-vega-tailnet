// Package gateway provides a single-server, authenticated loopback reverse proxy.
package gateway

import (
	"errors"
	"net"
	"net/netip"
	"net/url"
	"path"
	"strings"
)

// ParseTarget deliberately accepts only a server root, never credentials or tokens.
func ParseTarget(raw string) (*url.URL, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u == nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" {
		return nil, errors.New("enter a Jellyfin server URL such as http://nas:8096")
	}
	if u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Opaque != "" || u.RawPath != "" || strings.ContainsAny(u.Host, "\\ \t\r\n") {
		return nil, errors.New("the server URL must not contain credentials, query parameters, or encoded paths")
	}
	if strings.Contains(u.Path, "//") || path.Clean("/"+strings.Trim(u.Path, "/")) != "/"+strings.Trim(u.Path, "/") || strings.Contains(u.Path, "/web") {
		return nil, errors.New("use the server root or configured Jellyfin base path, without /web")
	}
	if p := u.Port(); p != "" {
		port, err := net.LookupPort("tcp", p)
		if err != nil || port < 1 || port > 65535 {
			return nil, errors.New("invalid server port")
		}
	}
	host := strings.ToLower(u.Hostname())
	if ip, err := netip.ParseAddr(host); err == nil {
		if !IsTailnetIP(ip) {
			return nil, errors.New("use a Tailscale IP (100.x or fd7a:115c:a1e0::), not a LAN or public IP")
		}
	} else {
		if host == "localhost" || strings.HasSuffix(host, ".localhost") || strings.HasSuffix(host, ".local") {
			return nil, errors.New("use the server's Tailscale IP or MagicDNS name")
		}
		for _, c := range host {
			if !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '-' || c == '.') {
				return nil, errors.New("invalid server hostname")
			}
		}
	}
	u.Path = strings.TrimRight(u.Path, "/")
	return u, nil
}

func IsTailnetIP(ip netip.Addr) bool {
	return netip.MustParsePrefix("100.64.0.0/10").Contains(ip) || netip.MustParsePrefix("fd7a:115c:a1e0::/48").Contains(ip)
}

func TargetAddress(u *url.URL) string {
	port := u.Port()
	if port == "" {
		port = "80"
		if u.Scheme == "https" {
			port = "443"
		}
	}
	return net.JoinHostPort(u.Hostname(), port)
}
