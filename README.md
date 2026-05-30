# Aplicação Distribuída com Microsserviços e Kubernetes

## Arquitetura

Esta é uma aplicação de exemplo baseada em microsserviços, contendo:

- **API Gateway**: Porta de entrada única para os microsserviços
- **Product Service**: Gerenciamento de produtos
- **Order Service**: Gerenciamento de pedidos
- **Payment Service**: Processamento de pagamentos
- **PostgreSQL**: Banco de dados relacional para persistência de dados

Tecnologias utilizadas:
- Node.js + Express
- Docker
- Kubernetes
- PostgreSQL (banco de dados)
- Prometheus (monitoramento)
- Grafana (visualização de métricas)
- Jaeger (tracing distribuído)
- GitHub Actions (CI/CD)

## Desenvolvimento Local

### Pré-requisitos

- Docker e Docker Compose
- Node.js 18+

### Iniciar a aplicação

```bash
docker-compose up -d --build
```

### Acessar os serviços

- **API Gateway**: http://localhost:3000
- **Product Service**: http://localhost:3001
- **Order Service**: http://localhost:3002
- **Payment Service**: http://localhost:3003
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3004 (usuário: admin, senha: admin)
- **Jaeger**: http://localhost:16686

### Endpoints da API

#### Produtos

```bash
# Listar produtos
curl http://localhost:3000/api/products

# Criar produto
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name": "Monitor", "price": 800.00, "stock": 30}'
```

#### Pedidos

```bash
# Listar pedidos
curl http://localhost:3000/api/orders

# Criar pedido
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"product_id": "<product-id>", "quantity": 2, "customer_id": "123"}'
```

#### Pagamentos

```bash
# Listar pagamentos
curl http://localhost:3000/api/payments
```

## Kubernetes

### Pré-requisitos

- Cluster Kubernetes (minikube, kind, EKS, GKE, AKS, etc.)
- kubectl configurado

### Implantar a aplicação

1. Construir as imagens Docker:

```bash
cd microservices/api-gateway && docker build -t api-gateway:latest .
cd ../product-service && docker build -t product-service:latest .
cd ../order-service && docker build -t order-service:latest .
cd ../payment-service && docker build -t payment-service:latest .
```

2. Implantar o PostgreSQL:

```bash
kubectl apply -f k8s/postgres.yaml
```

3. Implantar os microsserviços:

```bash
kubectl apply -f k8s/product-service.yaml
kubectl apply -f k8s/order-service.yaml
kubectl apply -f k8s/payment-service.yaml
kubectl apply -f k8s/api-gateway.yaml
```

4. Implantar ferramentas de observabilidade:

```bash
kubectl apply -f k8s/observability/
```

5. Verificar o status dos pods:

```bash
kubectl get pods
```

5. Acessar os serviços:

```bash
# API Gateway
kubectl get service api-gateway

# Grafana
kubectl get service grafana

# Jaeger
kubectl get service jaeger
```

## CI/CD Pipeline

O pipeline de CI/CD é configurado com GitHub Actions em `.github/workflows/ci-cd.yml` e executa:

1. **Build e Push** das imagens Docker para o GitHub Container Registry
2. **Deploy** para Kubernetes (apenas na branch `main`)

### Configuração necessária

1. Adicione o secret `KUBE_CONFIG` no repositório GitHub com o conteúdo do arquivo `~/.kube/config`

## Banco de Dados PostgreSQL

A aplicação utiliza PostgreSQL como banco de dados relacional para persistência de dados.

### Configuração (Docker Compose)

O banco de dados é inicializado automaticamente com:
- Usuário: `admin`
- Senha: `admin123`
- Banco: `microservices`

Scripts de inicialização estão na pasta `init-db/` e são executados automaticamente na primeira inicialização.

### Acessar o banco localmente

```bash
# Usando psql
psql -h localhost -p 5432 -U admin -d microservices

# Ou usando Docker
docker exec -it <postgres-container-id> psql -U admin -d microservices
```

### Schema do Banco

**Tabela products**
- `id` (UUID, PK)
- `name` (VARCHAR)
- `price` (NUMERIC)
- `stock` (INTEGER)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Tabela orders**
- `id` (UUID, PK)
- `product_id` (UUID)
- `quantity` (INTEGER)
- `customer_id` (VARCHAR)
- `total` (NUMERIC)
- `status` (VARCHAR)
- `payment_id` (UUID)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Tabela payments**
- `id` (UUID, PK)
- `order_id` (UUID)
- `amount` (NUMERIC)
- `status` (VARCHAR)
- `created_at` (TIMESTAMP)

## Observabilidade

### Prometheus

Acessível em http://localhost:9090 (local) ou via serviço Kubernetes. Métricas expostas por cada microsserviço em `/metrics`.

### Grafana

Acessível em http://localhost:3004 (local). Configure o Prometheus como fonte de dados e crie dashboards.

### Jaeger

Acessível em http://localhost:16686. Tracing distribuído pode ser adicionado com OpenTelemetry.

## Estrutura do Projeto

```
.
├── microservices/
│   ├── api-gateway/
│   │   ├── index.js
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── product-service/
│   │   ├── index.js
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── order-service/
│   │   ├── index.js
│   │   ├── package.json
│   │   └── Dockerfile
│   └── payment-service/
│       ├── index.js
│       ├── package.json
│       └── Dockerfile
├── k8s/
│   ├── api-gateway.yaml
│   ├── product-service.yaml
│   ├── order-service.yaml
│   ├── payment-service.yaml
│   ├── postgres.yaml
│   ├── ingress.yaml
│   └── observability/
│       ├── prometheus.yaml
│       ├── grafana.yaml
│       └── jaeger.yaml
├── .github/
│   └── workflows/
│       └── ci-cd.yml
├── init-db/
│   └── 01-init.sql
├── docker-compose.yml
├── prometheus.yml
└── README.md
```
