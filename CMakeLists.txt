cmake_minimum_required(VERSION 3.19)

set(CMAKE_POSITION_INDEPENDENT_CODE ON)
project(tailvega VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(turbomoduleAPI CONFIG REQUIRED)
find_program(GO_EXECUTABLE NAMES go REQUIRED)

string(TOLOWER "${CMAKE_SYSTEM_PROCESSOR}" TAILVEGA_PROCESSOR)
if(TAILVEGA_PROCESSOR MATCHES "^(arm|armv7|armv7l)$")
  set(TAILVEGA_GOARCH arm)
  set(TAILVEGA_GOARM 7)
elseif(TAILVEGA_PROCESSOR MATCHES "^(aarch64|arm64)$")
  set(TAILVEGA_GOARCH arm64)
  set(TAILVEGA_GOARM "")
elseif(TAILVEGA_PROCESSOR MATCHES "^(x86_64|amd64)$")
  set(TAILVEGA_GOARCH amd64)
  set(TAILVEGA_GOARM "")
else()
  message(FATAL_ERROR "Unsupported Vega target processor: ${CMAKE_SYSTEM_PROCESSOR}")
endif()

set(TAILSCALE_SOURCE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/third_party/libtailscale")
set(TAILSCALE_BUILD_DIR "${CMAKE_CURRENT_BINARY_DIR}/libtailscale-${TAILVEGA_GOARCH}")
set(TAILSCALE_ARCHIVE "${TAILSCALE_BUILD_DIR}/libtailscale.a")
file(GLOB TAILSCALE_BINDING_SOURCES CONFIGURE_DEPENDS
  "${TAILSCALE_SOURCE_DIR}/*.go"
  "${TAILSCALE_SOURCE_DIR}/*.c"
  "${TAILSCALE_SOURCE_DIR}/*.h"
)

set(TAILVEGA_CGO_FLAGS "--sysroot=${CMAKE_SYSROOT} ${CMAKE_C_FLAGS}")
set(TAILVEGA_CGO_LDFLAGS "--sysroot=${CMAKE_SYSROOT} ${CMAKE_EXE_LINKER_FLAGS}")

add_custom_command(
  OUTPUT "${TAILSCALE_ARCHIVE}"
  COMMAND "${CMAKE_COMMAND}" -E make_directory "${TAILSCALE_BUILD_DIR}"
  COMMAND "${CMAKE_COMMAND}" -E env
    "GOOS=linux"
    "GOARCH=${TAILVEGA_GOARCH}"
    "GOARM=${TAILVEGA_GOARM}"
    "CGO_ENABLED=1"
    "CC=${CMAKE_C_COMPILER}"
    "CGO_CFLAGS=${TAILVEGA_CGO_FLAGS}"
    "CGO_LDFLAGS=${TAILVEGA_CGO_LDFLAGS}"
    "GOCACHE=${CMAKE_CURRENT_BINARY_DIR}/go-build-cache"
    "GOMODCACHE=${CMAKE_CURRENT_BINARY_DIR}/go-module-cache"
    "${GO_EXECUTABLE}" build -trimpath -buildmode=c-archive
      -o "${TAILSCALE_ARCHIVE}" .
  WORKING_DIRECTORY "${TAILSCALE_SOURCE_DIR}"
  DEPENDS ${TAILSCALE_BINDING_SOURCES}
          "${TAILSCALE_SOURCE_DIR}/go.mod"
          "${TAILSCALE_SOURCE_DIR}/go.sum"
  COMMENT "Building libtailscale for Vega ${TAILVEGA_GOARCH}"
  VERBATIM
)

add_custom_target(libtailscale_build DEPENDS "${TAILSCALE_ARCHIVE}")
add_library(libtailscale STATIC IMPORTED GLOBAL)
set_target_properties(libtailscale PROPERTIES IMPORTED_LOCATION "${TAILSCALE_ARCHIVE}")
add_dependencies(libtailscale libtailscale_build)

set(TAILVEGA_SOURCES
  kepler/AutoLinkInit.cpp
  kepler/turbo-modules/generated/TailscaleSpec.cpp
  kepler/turbo-modules/Tailscale.cpp
)

kepler_add_turbo_module_library(tailvega ${TAILVEGA_SOURCES})
add_dependencies(tailvega libtailscale_build)
target_include_directories(tailvega PRIVATE
  "${CMAKE_CURRENT_SOURCE_DIR}/kepler/turbo-modules"
  "${TAILSCALE_SOURCE_DIR}"
)
target_link_libraries(tailvega PRIVATE libtailscale pthread dl m)

install(TARGETS tailvega)
