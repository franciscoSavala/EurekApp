#!/usr/bin/env bash

# ─── EurekApp — Instalación de dependencias de desarrollo ────────────────────
# Detecta el SO y instala: JDK 21, Docker, Docker Compose, Python3 + bcrypt, curl
# Al finalizar prepara .env.local y queda listo para correr start-local.sh

set -uo pipefail

# ─── Colores ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}── $* ──${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║   EurekApp — Setup entorno de desarrollo  ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

# ─── 1. Detectar sistema operativo ───────────────────────────────────────────
header "Detectando sistema operativo"

OS=""
DISTRO=""

case "$(uname -s)" in
  Darwin)
    OS="macos"
    ;;
  Linux)
    OS="linux"
    if [[ -f /etc/os-release ]]; then
      # shellcheck disable=SC1091
      source /etc/os-release
      DISTRO="${ID:-}"
    fi
    # Detectar WSL
    if grep -qi microsoft /proc/version 2>/dev/null; then
      warn "Entorno WSL detectado — el script continúa como Linux."
    fi
    ;;
  MINGW*|MSYS*|CYGWIN*)
    error "Ejecutá este script desde WSL (Windows Subsystem for Linux), no desde Git Bash o CMD."
    ;;
  *)
    error "Sistema operativo no soportado: $(uname -s)"
    ;;
esac

info "OS: ${OS} ${DISTRO:+(${DISTRO})}"

# ─── Helpers de instalación por distro ───────────────────────────────────────

pkg_install_apt()  { sudo apt-get install -y "$@"; }
pkg_install_dnf()  { sudo dnf install -y "$@"; }
pkg_install_brew() { brew install "$@"; }

detect_pkg_manager() {
  if [[ "$OS" == "macos" ]]; then
    echo "brew"
  elif command -v apt-get &>/dev/null; then
    echo "apt"
  elif command -v dnf &>/dev/null; then
    echo "dnf"
  elif command -v yum &>/dev/null; then
    echo "yum"
  else
    error "No se encontró un gestor de paquetes soportado (apt/dnf/yum/brew)."
  fi
}

PKG_MGR=$(detect_pkg_manager)
success "Gestor de paquetes: ${PKG_MGR}"

# ─── 2. Homebrew (solo macOS) ────────────────────────────────────────────────
if [[ "$OS" == "macos" ]]; then
  header "Verificando Homebrew"
  if ! command -v brew &>/dev/null; then
    info "Instalando Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Agregar brew al PATH para la sesión actual
    eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv 2>/dev/null)"
  fi
  brew update
  success "Homebrew OK"
fi

# ─── 3. curl ─────────────────────────────────────────────────────────────────
header "curl"
if command -v curl &>/dev/null; then
  success "curl ya instalado: $(curl --version | head -1)"
else
  info "Instalando curl..."
  case "$PKG_MGR" in
    apt)   sudo apt-get update -qq && pkg_install_apt curl ;;
    dnf)   pkg_install_dnf curl ;;
    yum)   sudo yum install -y curl ;;
    brew)  pkg_install_brew curl ;;
  esac
  success "curl instalado"
fi

# ─── 4. Java 21 ──────────────────────────────────────────────────────────────
header "Java 21"

java_ok() {
  command -v java &>/dev/null || return 1
  local ver
  ver=$(java -version 2>&1 | awk -F '"' '/version/{print $2}' | cut -d'.' -f1)
  [[ "${ver:-0}" -ge 21 ]] 2>/dev/null
}

if java_ok; then
  success "Java 21+ ya instalado: $(java -version 2>&1 | head -1)"
else
  info "Instalando JDK 21..."
  case "$PKG_MGR" in
    apt)
      sudo apt-get update -qq
      # Intentar temurin (adoptium) primero; si no, openjdk
      if ! pkg_install_apt temurin-21-jdk 2>/dev/null; then
        pkg_install_apt openjdk-21-jdk-headless
      fi
      ;;
    dnf)
      # Amazon Linux 2023 / Fedora / RHEL
      if [[ "${DISTRO:-}" == "amzn" ]]; then
        pkg_install_dnf java-21-amazon-corretto-headless
      else
        pkg_install_dnf java-21-openjdk-headless
      fi
      ;;
    yum)
      sudo yum install -y java-21-openjdk-headless
      ;;
    brew)
      pkg_install_brew openjdk@21
      # Agregar al PATH
      JAVA_HOME_BREW="$(brew --prefix openjdk@21)"
      export JAVA_HOME="$JAVA_HOME_BREW"
      export PATH="$JAVA_HOME/bin:$PATH"
      # Persistir en el shell profile
      PROFILE_FILE="$HOME/.zshrc"
      [[ -f "$HOME/.bash_profile" ]] && PROFILE_FILE="$HOME/.bash_profile"
      if ! grep -q "openjdk@21" "$PROFILE_FILE" 2>/dev/null; then
        {
          echo ""
          echo "# Java 21 (openjdk@21 via Homebrew)"
          echo "export JAVA_HOME=\"${JAVA_HOME_BREW}\""
          echo "export PATH=\"\$JAVA_HOME/bin:\$PATH\""
        } >> "$PROFILE_FILE"
        info "JAVA_HOME agregado a ${PROFILE_FILE}"
      fi
      ;;
  esac
  java_ok || error "No se pudo instalar Java 21. Instalalo manualmente desde https://adoptium.net/"
  success "Java 21 instalado: $(java -version 2>&1 | head -1)"
fi

# ─── 5. Docker ───────────────────────────────────────────────────────────────
header "Docker"

if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  success "Docker ya instalado y corriendo: $(docker --version)"
else
  if command -v docker &>/dev/null; then
    warn "Docker instalado pero no está corriendo."
  else
    info "Instalando Docker..."
    case "$PKG_MGR" in
      apt)
        sudo apt-get update -qq
        pkg_install_apt ca-certificates gnupg lsb-release
        sudo mkdir -p /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/${DISTRO}/gpg \
          | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
          https://download.docker.com/linux/${DISTRO} $(lsb_release -cs) stable" \
          | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        sudo apt-get update -qq
        pkg_install_apt docker-ce docker-ce-cli containerd.io docker-compose-plugin
        ;;
      dnf)
        if [[ "${DISTRO:-}" == "amzn" ]]; then
          pkg_install_dnf docker
          sudo systemctl enable --now docker
          sudo usermod -aG docker "${USER:-ec2-user}"
        else
          pkg_install_dnf docker-ce docker-ce-cli containerd.io docker-compose-plugin
        fi
        ;;
      yum)
        sudo yum install -y docker
        ;;
      brew)
        warn "En macOS instalá Docker Desktop manualmente desde https://docs.docker.com/desktop/mac/"
        warn "Una vez instalado, abrí Docker Desktop y esperá que inicie, luego volvé a correr este script."
        exit 0
        ;;
    esac
  fi

  # Iniciar servicio en Linux
  if [[ "$OS" == "linux" ]]; then
    sudo systemctl enable --now docker 2>/dev/null || true
    # Agregar usuario al grupo docker (evita usar sudo)
    if ! groups "${USER:-}" | grep -q docker; then
      sudo usermod -aG docker "${USER:-}"
      warn "Usuario agregado al grupo 'docker'. Cerrá y volvé a abrir la sesión para que tome efecto."
      warn "Luego volvé a correr: bash install-dev.sh"
      exit 0
    fi
  fi

  docker info &>/dev/null 2>&1 || error "Docker no está corriendo. Inicialo y volvé a ejecutar el script."
  success "Docker instalado y corriendo: $(docker --version)"
fi

# ─── 6. Docker Compose plugin ────────────────────────────────────────────────
header "Docker Compose"

if docker compose version &>/dev/null 2>&1; then
  success "Docker Compose ya disponible: $(docker compose version)"
else
  info "Instalando Docker Compose plugin..."
  case "$PKG_MGR" in
    apt)
      pkg_install_apt docker-compose-plugin
      ;;
    dnf|yum)
      COMPOSE_VERSION="v2.27.1"
      COMPOSE_DIR="/usr/local/lib/docker/cli-plugins"
      sudo mkdir -p "$COMPOSE_DIR"
      sudo curl -SL \
        "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
        -o "$COMPOSE_DIR/docker-compose"
      sudo chmod +x "$COMPOSE_DIR/docker-compose"
      ;;
    brew)
      : # Docker Desktop en macOS ya incluye compose
      ;;
  esac
  docker compose version &>/dev/null 2>&1 || error "No se pudo instalar Docker Compose plugin."
  success "Docker Compose instalado: $(docker compose version)"
fi

# ─── 7. Python 3 + bcrypt ────────────────────────────────────────────────────
header "Python 3 + bcrypt"

install_bcrypt() {
  python3 -m pip install bcrypt -q --break-system-packages 2>/dev/null \
    || python3 -m pip install bcrypt -q 2>/dev/null \
    || true
}

if ! command -v python3 &>/dev/null; then
  info "Instalando Python 3..."
  case "$PKG_MGR" in
    apt)   sudo apt-get update -qq && pkg_install_apt python3 python3-pip ;;
    dnf)   pkg_install_dnf python3 python3-pip ;;
    yum)   sudo yum install -y python3 python3-pip ;;
    brew)  pkg_install_brew python3 ;;
  esac
fi

if ! python3 -c "import bcrypt" &>/dev/null 2>&1; then
  info "Instalando módulo bcrypt..."
  install_bcrypt
fi

python3 -c "import bcrypt" &>/dev/null 2>&1 \
  && success "Python 3 + bcrypt OK: $(python3 --version)" \
  || warn "No se pudo instalar bcrypt. seed-local.sh usará un hash de fallback."

# ─── 8. Preparar .env.local ──────────────────────────────────────────────────
header "Configuración de entorno (.env.local)"

ENV_FILE="$SCRIPT_DIR/.env.local"
ENV_EXAMPLE="$SCRIPT_DIR/.env.local.example"

if [[ -f "$ENV_FILE" ]]; then
  success ".env.local ya existe"
else
  if [[ -f "$ENV_EXAMPLE" ]]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    success ".env.local creado desde .env.local.example"
  else
    error "No se encontró .env.local.example en $SCRIPT_DIR"
  fi
fi

# ─── 9. Verificar claves pendientes ──────────────────────────────────────────
header "Verificando claves en .env.local"

MISSING=()
# shellcheck disable=SC1090
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line//$'\r'/}"
  [[ -z "$line" || "$line" == \#* ]] && continue
  [[ "$line" == *=* ]] || continue
  key="${line%%=*}"; value="${line#*=}"
  value="${value%\"}"; value="${value#\"}"; value="${value%\'}"; value="${value#\'}"
  export "$key=$value"
done < "$ENV_FILE"

[[ -z "${OPENAI_SECRET_KEY:-}"     || "${OPENAI_SECRET_KEY}"     == "sk-..."                                ]] && MISSING+=("OPENAI_SECRET_KEY")
[[ -z "${JWT_SIGN_KEY:-}"          || "${JWT_SIGN_KEY}"          == "cambia-esto-por-un-string-largo-y-random-local" ]] && MISSING+=("JWT_SIGN_KEY")
[[ -z "${AWS_ACCESS_KEY_ID:-}"     || "${AWS_ACCESS_KEY_ID}"     == "AKIA..."                               ]] && MISSING+=("AWS_ACCESS_KEY_ID")
[[ -z "${AWS_SECRET_ACCESS_KEY:-}" || "${AWS_SECRET_ACCESS_KEY}" == "tu-secret-key-de-aws"                  ]] && MISSING+=("AWS_SECRET_ACCESS_KEY")

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo ""
  echo -e "${YELLOW}${BOLD}⚠  Las siguientes claves en .env.local todavía tienen valores de ejemplo:${NC}"
  for k in "${MISSING[@]}"; do
    echo -e "     ${YELLOW}→ $k${NC}"
  done
  echo ""
  echo -e "  Editá el archivo ${BOLD}${ENV_FILE}${NC} con los valores reales antes de continuar."
  echo ""
else
  success "Todas las claves de .env.local están configuradas"
fi

# ─── 10. Resumen final ────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║          Instalación completada                          ║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Java    : $(java -version 2>&1 | awk -F '"' '/version/{print $2}')                                           ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Docker  : $(docker --version | awk '{print $3}' | tr -d ',')                                        ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Python  : $(python3 --version 2>&1 | awk '{print $2}')                                          ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════╣${NC}"

if [[ ${#MISSING[@]} -gt 0 ]]; then
echo -e "${GREEN}${BOLD}║${NC}  ${YELLOW}Antes de continuar: completá .env.local${NC}               ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    ${BOLD}nano ${ENV_FILE}${NC}                  ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════╣${NC}"
fi

echo -e "${GREEN}${BOLD}║${NC}  Pasos siguientes:                                        ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    1. bash start-local.sh    ← levanta infra + backend    ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}    2. bash seed-local.sh     ← carga datos de prueba      ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
