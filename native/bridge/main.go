package main

/*
#include <stdlib.h>
*/
import "C"

import (
	"encoding/json"
	"sync"

	"github.com/looizao/jellyfin-vega-tailnet/native/engine"
)

var mu sync.Mutex
var node *engine.Engine

func result(value any, err error) *C.char {
	if err != nil {
		value = map[string]string{"error": err.Error()}
	}
	data, _ := json.Marshal(value)
	return C.CString(string(data)) // Caller owns the returned allocation; use free().
}

//export jv_start
func jv_start(dir, config *C.char) *C.char {
	mu.Lock()
	defer mu.Unlock()
	var c engine.Config
	if err := json.Unmarshal([]byte(C.GoString(config)), &c); err != nil {
		return result(nil, err)
	}
	if node == nil {
		node = engine.New(C.GoString(dir))
	}
	s, err := node.Start(c)
	return result(s, err)
}

//export jv_status
func jv_status() *C.char {
	mu.Lock()
	defer mu.Unlock()
	if node == nil {
		return result(engine.Snapshot{State: "Stopped", IPs: []string{}}, nil)
	}
	s, err := node.Status()
	return result(s, err)
}

//export jv_stop
func jv_stop() {
	mu.Lock()
	defer mu.Unlock()
	if node != nil {
		node.Stop()
	}
}

//export jv_check
func jv_check() *C.char {
	mu.Lock()
	defer mu.Unlock()
	if node == nil {
		return C.CString(`{"error":"connect to Tailscale first"}`)
	}
	s, err := node.Check()
	return result(map[string]string{"server": s}, err)
}

func main() {}
