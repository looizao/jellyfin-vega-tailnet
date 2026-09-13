#include "libtailscale.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
int main(void) {
  char dir[] = "/tmp/jellyvega-abi-XXXXXX";
  assert(mkdtemp(dir));
  char *response = jv_status();
  assert(response && strstr(response, "Stopped")); free(response);
  response = jv_start(dir, "{}");
  assert(response && strstr(response, "Stopped")); free(response);
  response = jv_start(dir, "{\"serverUrl\":\"http://127.0.0.1:8096\"}");
  assert(response && strstr(response, "error")); free(response);
  response = jv_check();
  assert(response && strstr(response, "error")); free(response);
  jv_stop(); jv_stop(); rmdir(dir);
  puts("C ABI lifecycle and invalid-configuration smoke test passed");
  return 0;
}
