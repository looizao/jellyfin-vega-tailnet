#include "tailscale.h"

#include <stdio.h>

int main(void) {
  tailscale server = tailscale_new();
  if (server < 0) {
    fprintf(stderr, "tailscale_new failed\n");
    return 1;
  }
  if (tailscale_set_dir(server, "/tmp/tailvega-smoke") != 0) {
    fprintf(stderr, "tailscale_set_dir failed\n");
    return 2;
  }
  if (tailscale_set_hostname(server, "tailvega-smoke") != 0) {
    fprintf(stderr, "tailscale_set_hostname failed\n");
    return 3;
  }
  if (tailscale_set_logfd(server, -1) != 0) {
    fprintf(stderr, "tailscale_set_logfd failed\n");
    return 4;
  }
  if (tailscale_close(server) != 0) {
    fprintf(stderr, "tailscale_close failed\n");
    return 5;
  }
  puts("libtailscale lifecycle smoke test passed");
  return 0;
}
