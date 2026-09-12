#include "Tailscale.h"

#include <algorithm>
#include <array>
#include <chrono>
#include <cctype>
#include <cstdlib>
#include <filesystem>
#include <memory>
#include <stdexcept>
#include <thread>
#include <unistd.h>
#include <utility>

using namespace com::amazon::kepler::turbomodule;

namespace tailvega {

namespace {

constexpr const char *kStateDirectory =
    "/home/app_user/packages/com.looizao.tailvega/data/tailscale";
constexpr const char *kEngineVersion = "libtailscale 8077131 / tailscale 1.94.1";

class SensitiveStringWiper {
public:
  explicit SensitiveStringWiper(std::string &value) : value_(value) {}
  SensitiveStringWiper(const SensitiveStringWiper &) = delete;
  SensitiveStringWiper &operator=(const SensitiveStringWiper &) = delete;
  ~SensitiveStringWiper() { std::fill(value_.begin(), value_.end(), '\0'); }

private:
  std::string &value_;
};

std::string lastError(tailscale server) {
  std::array<char, 2048> buffer{};
  if (tailscale_errmsg(server, buffer.data(), buffer.size()) != 0) {
    return "Unknown libtailscale error";
  }
  return std::string(buffer.data());
}

std::string statusJson(const std::shared_ptr<EngineState> &state) {
  if (state->server < 0) {
    return R"({"BackendState":"Stopped","TailscaleIPs":[]})";
  }

  char *raw = nullptr;
  if (tailscale_status_json(state->server, &raw) != 0) {
    throw std::runtime_error(lastError(state->server));
  }

  std::string result(raw == nullptr ? "{}" : raw);
  std::free(raw);
  return result;
}

std::string responseJson(const std::shared_ptr<EngineState> &state) {
  return std::string{"{\"status\":"} + statusJson(state) +
         ",\"proxy\":{\"address\":\"" + state->proxyAddress +
         "\",\"username\":\"tsnet\",\"password\":\"" +
         state->proxyCredential + "\"}}";
}

bool isSafeAddress(const std::string &address) {
  if (address.empty() || address.size() > 300 ||
      address.find(':') == std::string::npos) {
    return false;
  }
  return std::all_of(address.begin(), address.end(), [](unsigned char value) {
    return std::isalnum(value) || value == '.' || value == '-' || value == ':' ||
           value == '[' || value == ']';
  });
}

} // namespace

Tailscale::Tailscale() : state_(std::make_shared<EngineState>()) {}

Tailscale::~Tailscale() noexcept {
  auto state = state_;
  std::lock_guard<std::mutex> lock(state->mutex);
  if (state->server >= 0) {
    tailscale_close(state->server);
    state->server = -1;
  }
}

Promise Tailscale::connect(std::string authKey, std::string hostname) {
  auto state = state_;
  return Promise([state, authKey = std::move(authKey),
                  hostname = std::move(hostname)](
                     const std::shared_ptr<Promise> &promise) mutable {
    std::thread([state, authKey = std::move(authKey),
                 hostname = std::move(hostname), promise]() mutable {
      SensitiveStringWiper wipeAuthKey(authKey);
      std::lock_guard<std::mutex> lock(state->mutex);

      if (authKey.empty() &&
          !std::filesystem::exists(
              std::filesystem::path{kStateDirectory} / "tailscaled.state")) {
        promise->reject("A one-time Tailscale auth key is required");
        return;
      }

      if (state->server >= 0) {
        try {
          promise->resolve(responseJson(state));
        } catch (const std::exception &error) {
          promise->reject(error.what());
        }
        return;
      }

      std::error_code directoryError;
      std::filesystem::create_directories(kStateDirectory, directoryError);
      if (directoryError) {
        promise->reject("Unable to create the private Tailscale state directory: " +
                        directoryError.message());
        return;
      }

      state->server = tailscale_new();
      if (state->server < 0) {
        promise->reject("Unable to create the embedded Tailscale node");
        return;
      }

      auto fail = [&](const std::string &message) {
        const std::string detail = lastError(state->server);
        tailscale_close(state->server);
        state->server = -1;
        promise->reject(message + ": " + detail);
      };

      if (tailscale_set_dir(state->server, kStateDirectory) != 0) {
        fail("Unable to configure the Tailscale state directory");
        return;
      }
      if (tailscale_set_hostname(
              state->server,
              hostname.empty() ? "fire-tv-tailvega" : hostname.c_str()) != 0) {
        fail("Unable to configure the Tailscale hostname");
        return;
      }
      if (!authKey.empty() &&
          tailscale_set_authkey(state->server, authKey.c_str()) != 0) {
        fail("Unable to configure the Tailscale auth key");
        return;
      }
      if (tailscale_set_logfd(state->server, -1) != 0) {
        fail("Unable to disable engine logs");
        return;
      }
      if (tailscale_up(state->server) != 0) {
        fail("Unable to join the tailnet");
        return;
      }

      std::array<char, 128> address{};
      std::array<char, 33> proxyCredential{};
      std::array<char, 33> localApiCredential{};
      if (tailscale_loopback(state->server, address.data(), address.size(),
                             proxyCredential.data(),
                             localApiCredential.data()) != 0) {
        fail("Tailnet joined, but the local SOCKS5 proxy could not start");
        return;
      }

      state->proxyAddress = address.data();
      state->proxyCredential = proxyCredential.data();
      std::fill(localApiCredential.begin(), localApiCredential.end(), '\0');

      try {
        promise->resolve(responseJson(state));
      } catch (const std::exception &error) {
        promise->reject(error.what());
      }
    }).detach();
  });
}

Promise Tailscale::status() {
  auto state = state_;
  return Promise([state](const std::shared_ptr<Promise> &promise) {
    std::thread([state, promise]() {
      std::lock_guard<std::mutex> lock(state->mutex);
      try {
        promise->resolve(responseJson(state));
      } catch (const std::exception &error) {
        promise->reject(error.what());
      }
    }).detach();
  });
}

Promise Tailscale::disconnect() {
  auto state = state_;
  return Promise([state](const std::shared_ptr<Promise> &promise) {
    std::thread([state, promise]() {
      std::lock_guard<std::mutex> lock(state->mutex);
      if (state->server < 0) {
        promise->resolve(true);
        return;
      }

      const int result = tailscale_close(state->server);
      state->server = -1;
      state->proxyAddress.clear();
      state->proxyCredential.clear();
      if (result != 0) {
        promise->reject("Unable to stop the embedded Tailscale node");
        return;
      }
      promise->resolve(true);
    }).detach();
  });
}

Promise Tailscale::probe(std::string address) {
  auto state = state_;
  return Promise([state, address = std::move(address)](
                     const std::shared_ptr<Promise> &promise) mutable {
    std::thread([state, address = std::move(address), promise]() {
      std::lock_guard<std::mutex> lock(state->mutex);
      if (state->server < 0) {
        promise->reject("Connect to your tailnet before probing a service");
        return;
      }
      if (!isSafeAddress(address)) {
        promise->reject("Use a host:port address containing only DNS or IP characters");
        return;
      }

      const auto started = std::chrono::steady_clock::now();
      tailscale_conn connection = -1;
      if (tailscale_dial(state->server, "tcp", address.c_str(), &connection) != 0) {
        promise->reject("Could not reach " + address + ": " +
                        lastError(state->server));
        return;
      }
      close(connection);
      const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
                               std::chrono::steady_clock::now() - started)
                               .count();
      promise->resolve(std::string{"{\"ok\":true,\"address\":\""} + address +
                       "\",\"latencyMs\":" + std::to_string(elapsed) + "}");
    }).detach();
  });
}

std::string Tailscale::engineVersion() { return kEngineVersion; }

} // namespace tailvega
