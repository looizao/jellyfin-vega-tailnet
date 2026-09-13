package gateway

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
)

//go:embed adapter.js
var adapterJS string

var headTag = regexp.MustCompile(`(?i)<head(?:\s[^>]*)?>`)

func (g *Gateway) adapter() string {
	server, _ := json.Marshal(g.target.String())
	return strings.ReplaceAll(adapterJS, "__SERVER_URL__", string(server))
}

func (g *Gateway) injectAdapter(r *http.Response) error {
	if r.Request.URL.Path != g.target.Path+"/web/index.html" || r.StatusCode != http.StatusOK {
		return nil
	}
	if !strings.Contains(r.Header.Get("Content-Type"), "text/html") {
		return errors.New("expected the Jellyfin web interface")
	}
	const maxHTML = 4 << 20
	body, err := io.ReadAll(io.LimitReader(r.Body, maxHTML+1))
	_ = r.Body.Close()
	if err != nil || len(body) > maxHTML {
		return errors.New("invalid Jellyfin web entry page")
	}
	loc := headTag.FindIndex(body)
	if loc == nil {
		return errors.New("missing HTML head in the Jellyfin web entry page")
	}
	var out bytes.Buffer
	out.Write(body[:loc[1]])
	out.WriteString(`<script src="/_jellyvega/adapter.js"></script>`)
	out.Write(body[loc[1]:])
	r.Body = io.NopCloser(bytes.NewReader(out.Bytes()))
	r.ContentLength = int64(out.Len())
	r.Header.Set("Content-Length", strconv.Itoa(out.Len()))
	r.Header.Set("Cache-Control", "no-store")
	r.Header.Del("ETag")
	r.Header.Del("Content-Encoding")
	return nil
}
