package engine

import (
	"net/netip"
	"tailscale.com/ipn/ipnstate"
	"testing"
)

func TestPeerResolutionNeverFallsBackToPublicDNS(t *testing.T) {
	ip := netip.MustParseAddr("100.64.0.1")
	status := &ipnstate.Status{Self: &ipnstate.PeerStatus{DNSName: "nas.tail123.ts.net.", TailscaleIPs: []netip.Addr{ip}}}
	for _, host := range []string{"nas", "NAS.tail123.ts.net.", "100.64.0.1"} {
		got, err := peerIP(status, host)
		if err != nil || got != ip {
			t.Errorf("%s: %v %v", host, got, err)
		}
	}
	for _, host := range []string{"example.com", "127.0.0.1", "192.168.1.1", "nas.attacker.test", "localhost", "8.8.8.8"} {
		if _, err := peerIP(status, host); err == nil {
			t.Errorf("public fallback allowed for %s", host)
		}
	}
}

func TestFirstRunAndInvalidConfig(t *testing.T) {
	e := New(t.TempDir())
	s, err := e.Start(Config{})
	if err != nil || s.State != "Stopped" {
		t.Fatalf("first run: %v %v", s, err)
	}
	if _, err := e.Start(Config{ServerURL: "http://127.0.0.1"}); err == nil {
		t.Fatal("accepted loopback target")
	}
	if _, err := e.Check(); err == nil {
		t.Fatal("check without connection succeeded")
	}
	e.Stop()
	e.Stop()
}
