#include "Tailscale.h"
#include "libtailscale.h"
#include <algorithm>
#include <cstdlib>
#include <functional>
#include <thread>
using namespace com::amazon::kepler::turbomodule;
namespace jellyvega {
struct EngineOwner { ~EngineOwner() { jv_stop(); } };
namespace {
constexpr const char *kDataDirectory = "/home/app_user/packages/com.looizao.jellyvega/data";
Promise callAsync(std::shared_ptr<EngineOwner> owner, std::function<char *()> work) {
  return Promise([owner, work](const std::shared_ptr<Promise> &promise) {
    std::thread([owner, work, promise]() {
      char *raw = work();
      const std::string response = raw ? raw : R"({"error":"native allocation failed"})";
      std::free(raw);
      promise->resolve(response);
    }).detach();
  });
}
}
Tailscale::Tailscale() : owner_(std::make_shared<EngineOwner>()) {}
Tailscale::~Tailscale() noexcept = default;
Promise Tailscale::start(std::string config) {
  return callAsync(owner_, [config = std::move(config)]() mutable {
    char *response = jv_start(const_cast<char *>(kDataDirectory), config.data());
    std::fill(config.begin(), config.end(), '\0');
    return response;
  });
}
Promise Tailscale::status() { return callAsync(owner_, [] { return jv_status(); }); }
Promise Tailscale::checkServer() { return callAsync(owner_, [] { return jv_check(); }); }
Promise Tailscale::stop() {
  auto owner = owner_;
  return Promise([owner](const std::shared_ptr<Promise> &promise) {
    std::thread([owner, promise]() { jv_stop(); promise->resolve(true); }).detach();
  });
}
std::string Tailscale::engineVersion() { return "Tailscale 1.102.4"; }
}
