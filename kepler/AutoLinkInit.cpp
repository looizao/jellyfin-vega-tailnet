#include <Kepler/turbomodule/KeplerTurboModuleRegistration.h>

#include "turbo-modules/Tailscale.h"

extern "C" {
__attribute__((visibility("default"))) void
autoLinkVegaTurboModulesV1() noexcept {
  KEPLER_REGISTER_TURBO_MODULE(tailvega, Tailscale);
}
}
