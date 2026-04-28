#!/usr/bin/env bash
set -euo pipefail

# ─── EurekApp — Setup inicial EC2 (Amazon Linux 2023) ────────────────────────
# Correr UNA SOLA VEZ en una instancia nueva.
# Prerequisito: los archivos de la app deben estar en /opt/eurekapp/
#   (docker-compose.prod.yml, init-weaviate.sh, eurekapp.service, .env.prod)

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   EurekApp — EC2 Setup (una vez)     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# ─── 0. Swap (1GB — red de seguridad para t2.micro 1GB RAM) ──────────────────
if [[ ! -f /swapfile ]]; then
  info "Creando 1GB de swap..."
  sudo fallocate -l 1G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
  success "Swap 1GB activado"
else
  success "Swap ya existe, saltando"
fi

# ─── 1. Java 21 (Amazon Corretto) ────────────────────────────────────────────
info "Instalando Amazon Corretto 21..."
sudo dnf install -y java-21-amazon-corretto-headless
success "Java 21 instalado: $(java -version 2>&1 | head -1)"

# ─── 2. Docker ───────────────────────────────────────────────────────────────
info "Instalando Docker..."
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
success "Docker instalado y habilitado"

# ─── 3. Docker Compose plugin ────────────────────────────────────────────────
info "Instalando Docker Compose plugin..."
DOCKER_CONFIG=/usr/local/lib/docker
sudo mkdir -p "$DOCKER_CONFIG/cli-plugins"
sudo curl -SL \
  "https://github.com/docker/compose/releases/download/v2.27.1/docker-compose-linux-x86_64" \
  -o "$DOCKER_CONFIG/cli-plugins/docker-compose"
sudo chmod +x "$DOCKER_CONFIG/cli-plugins/docker-compose"
success "Docker Compose instalado: $(sudo docker compose version)"

# ─── 4. Directorio de la app ──────────────────────────────────────────────────
info "Preparando /opt/eurekapp/..."
sudo mkdir -p /opt/eurekapp
sudo chown ec2-user:ec2-user /opt/eurekapp
chmod +x /opt/eurekapp/init-weaviate.sh 2>/dev/null || true
success "Directorio /opt/eurekapp/ listo"

# ─── 5. Servicio systemd ─────────────────────────────────────────────────────
if [[ ! -f /opt/eurekapp/eurekapp.service ]]; then
  error "No se encontró /opt/eurekapp/eurekapp.service. Copialo antes de correr este script."
fi

info "Instalando servicio systemd..."
sudo cp /opt/eurekapp/eurekapp.service /etc/systemd/system/eurekapp.service
sudo systemctl daemon-reload
sudo systemctl enable eurekapp
success "Servicio eurekapp instalado y habilitado (no iniciado aún)"

# ─── 6. Levantar Weaviate (MySQL está en RDS, no en Docker) ──────────────────
if [[ ! -f /opt/eurekapp/docker-compose.prod.yml ]]; then
  error "docker-compose.prod.yml no encontrado en /opt/eurekapp/."
fi

info "Levantando Weaviate..."
cd /opt/eurekapp
sudo docker compose -f docker-compose.prod.yml up -d weaviate

info "Esperando que Weaviate esté listo (puede tardar ~30s)..."
MAX=40
i=0
while true; do
  STATUS=$(sudo docker inspect --format='{{.State.Health.Status}}' eurekapp-weaviate-prod 2>/dev/null || echo "starting")
  if [[ "$STATUS" == "healthy" ]]; then
    break
  fi
  i=$((i + 1))
  if [[ $i -ge $MAX ]]; then
    error "Weaviate no respondió en tiempo. Revisá: docker logs eurekapp-weaviate-prod"
  fi
  echo -n "."
  sleep 3
done
echo ""
success "Weaviate listo"

# ─── 7. Inicializar schema de Weaviate ───────────────────────────────────────
info "Inicializando schema de Weaviate..."
bash /opt/eurekapp/init-weaviate.sh
success "Schema inicializado"

# ─── 8. Nginx (reverse proxy :80 → :8080) ────────────────────────────────────
info "Instalando Nginx..."
sudo dnf install -y nginx

sudo tee /etc/nginx/conf.d/eurekapp.conf > /dev/null <<'NGINX'
server {
    listen 80;
    server_name _;
    client_max_body_size 20M;

    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }
}
NGINX

sudo systemctl enable --now nginx
success "Nginx instalado y corriendo"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Setup completo.                                         ║${NC}"
echo -e "${GREEN}║  Hacé push a main para que GitHub Actions despliegue     ║${NC}"
echo -e "${GREEN}║  el JAR y levante el servicio automáticamente.           ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║  O para iniciar manualmente:                             ║${NC}"
echo -e "${GREEN}║    sudo systemctl start eurekapp                         ║${NC}"
echo -e "${GREEN}║    sudo journalctl -u eurekapp -f                        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
