#pragma once
#include "generated/TailscaleSpec.h"
#include <memory>
#include <string>
namespace jellyvega {
struct EngineOwner;
class Tailscale : public TailscaleSpec {
public:
  Tailscale();
  ~Tailscale() noexcept;
  com::amazon::kepler::turbomodule::Promise start(std::string config) override;
  com::amazon::kepler::turbomodule::Promise status() override;
  com::amazon::kepler::turbomodule::Promise stop() override;
  com::amazon::kepler::turbomodule::Promise checkServer() override;
  std::string engineVersion() override;
private:
  std::shared_ptr<EngineOwner> owner_;
};
}
